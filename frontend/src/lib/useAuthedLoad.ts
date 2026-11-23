"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import { ApiError, fetchMe, type User } from "@/lib/api";
import { hardNavigate } from "@/lib/hardNavigate";

export type AuthedLoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; user: User; data: T };

type Update<T> = (prev: AuthedLoadState<T>) => AuthedLoadState<T>;

/** Reloaded data for a page already showing its data; nothing to do before that. */
function showReloadedData<T>(data: T): Update<T> {
  return (prev) => (prev.status === "ready" ? { ...prev, data } : prev);
}

/** Both requests answered: a first load shows both, a page already showing refreshes the user. */
function showLoaded<T>(user: User, data: T): Update<T> {
  return (prev) => (prev.status === "ready" ? { ...prev, user } : { status: "ready", user, data });
}

function showFailure<T>(error: unknown): Update<T> {
  return () => ({
    status: "error",
    message: error instanceof Error ? error.message : "Failed to load.",
  });
}

function isRejectedSession(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Loads the signed-in user plus page data on mount, and again each time Next shows the
 * kept page again. The first load waits for both; a page already showing its data gets
 * reloaded data as soon as it arrives (#40). The session is the httpOnly cookie, so a
 * missing or expired one shows up as a 401 from the API; those visitors go to /login.
 */
export function useAuthedLoad<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<AuthedLoadState<T>>({ status: "loading" });
  const load = useEffectEvent(loader);
  // How many times the page has changed its data (setData), so a reload that was out
  // meanwhile can tell that its answer may predate the change (#43).
  const changes = useRef(0);

  // A full page load, not router.replace: Next keeps visited pages mounted, and a
  // rejected session must not leave one user's forms behind for the next (#24).
  const signOut = useCallback(() => {
    hardNavigate("/login");
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Ask again while the page changed its data during the request (a filter, a new
    // product, a stock adjustment): the next request starts after that change was saved,
    // so its answer includes it instead of replacing it (#43).
    async function loadSinceLastChange(): Promise<T> {
      let seen: number;
      let data: T;
      do {
        seen = changes.current;
        data = await load();
      } while (!cancelled && changes.current !== seen);
      return data;
    }

    const userRequest = fetchMe();
    const dataRequest = loadSinceLastChange();

    // Next shows a kept page again by running this effect again. A page already showing
    // its data gets the reloaded data as soon as it arrives: nothing changed since that
    // request went out, and waiting for fetchMe would undo whatever the page did
    // meanwhile (#40). The first load still waits for both, below.
    void dataRequest.then(
      (data) => {
        if (!cancelled) setState(showReloadedData<T>(data));
      },
      () => {}, // failures are handled below, together with the session
    );

    // allSettled, not all: a rejected session must win over a page error that
    // happens to settle first (e.g. a malformed id rejected without a request).
    void Promise.allSettled([userRequest, dataRequest]).then(([user, data]) => {
      if (cancelled) return;
      if (user.status === "fulfilled" && data.status === "fulfilled") {
        setState(showLoaded<T>(user.value, data.value));
        return;
      }
      const errors = [user, data].flatMap((result) =>
        result.status === "rejected" ? [result.reason as unknown] : [],
      );
      if (errors.some(isRejectedSession)) {
        hardNavigate("/login");
        return;
      }
      setState(showFailure<T>(errors[0]));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setData = useCallback((update: (data: T) => T) => {
    changes.current += 1;
    setState((prev) => (prev.status === "ready" ? { ...prev, data: update(prev.data) } : prev));
  }, []);

  return { state, setData, signOut };
}
