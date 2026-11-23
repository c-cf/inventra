"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { ApiError, fetchMe, type User } from "@/lib/api";
import { hardNavigate } from "@/lib/hardNavigate";

export type AuthedLoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; user: User; data: T };

/**
 * Loads the signed-in user plus page data once on mount. The session is the
 * httpOnly cookie, so a missing or expired one shows up as a 401 from the API;
 * those visitors are sent to /login.
 */
export function useAuthedLoad<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<AuthedLoadState<T>>({ status: "loading" });
  const load = useEffectEvent(loader);

  // A full page load, not router.replace: Next keeps visited pages mounted, and a
  // rejected session must not leave one user's forms behind for the next (#24).
  const signOut = useCallback(() => {
    hardNavigate("/login");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const userRequest = fetchMe();
    const dataRequest = load();

    // Next shows a kept page again by running this effect again. A page already showing
    // its data gets the reloaded data as soon as it arrives: its loader has just checked
    // its filters, and waiting for fetchMe would undo whatever the page did meanwhile
    // (#40). The first load still waits for both, below.
    void dataRequest.then(
      (data) => {
        if (cancelled) return;
        setState((prev) => (prev.status === "ready" ? { ...prev, data } : prev));
      },
      () => {}, // failures are handled below, together with the session
    );

    // allSettled, not all: a rejected session must win over a page error that
    // happens to settle first (e.g. a malformed id rejected without a request).
    void Promise.allSettled([userRequest, dataRequest]).then(([user, data]) => {
      if (cancelled) return;
      if (user.status === "fulfilled" && data.status === "fulfilled") {
        // Already showing: the data went on screen when it arrived; refresh only the user.
        setState((prev) =>
          prev.status === "ready"
            ? { ...prev, user: user.value }
            : { status: "ready", user: user.value, data: data.value },
        );
        return;
      }
      const errors = [user, data].flatMap((result) =>
        result.status === "rejected" ? [result.reason as unknown] : [],
      );
      if (errors.some((error) => error instanceof ApiError && error.status === 401)) {
        hardNavigate("/login");
        return;
      }
      const [error] = errors;
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load.",
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setData = useCallback((update: (data: T) => T) => {
    setState((prev) => (prev.status === "ready" ? { ...prev, data: update(prev.data) } : prev));
  }, []);

  return { state, setData, signOut };
}
