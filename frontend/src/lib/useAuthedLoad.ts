"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { ApiError, fetchMe, type User } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

export type AuthedLoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; token: string; user: User; data: T };

/**
 * Loads the signed-in user plus page data once on mount. Sends visitors without
 * a token (or with a rejected one) to /login, like the products page does.
 */
export function useAuthedLoad<T>(loader: (token: string) => Promise<T>) {
  const router = useRouter();
  const [state, setState] = useState<AuthedLoadState<T>>({ status: "loading" });
  const load = useEffectEvent(loader);

  const signOut = useCallback(() => {
    clearToken();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    Promise.all([fetchMe(token), load(token)]).then(
      ([user, data]) => {
        if (!cancelled) setState({ status: "ready", token, user, data });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load.",
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [router]);

  const setData = useCallback((update: (data: T) => T) => {
    setState((prev) => (prev.status === "ready" ? { ...prev, data: update(prev.data) } : prev));
  }, []);

  return { state, setData, signOut };
}
