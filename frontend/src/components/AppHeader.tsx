"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { logout, type User } from "@/lib/api";

type AppHeaderProps = {
  user: User | null;
};

export function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function signOut() {
    setSignOutError(null);
    try {
      await logout(); // only the API can clear the httpOnly session cookie
    } catch {
      // Leaving now would look like a sign-out while the session is still valid.
      setSignOutError("Could not sign out. Check your connection and try again.");
      return;
    }
    router.push("/login");
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <nav className="flex items-center gap-6">
          <Link href="/products" className="text-lg font-semibold tracking-tight">
            Inventra
          </Link>
          <Link
            href="/products"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Products
          </Link>
          <Link
            href="/orders"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Orders
          </Link>
          {user?.role === "admin" && (
            <Link
              href="/users"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Users
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          {user && (
            <Link
              href="/account"
              className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <span>{user.username}</span>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs uppercase tracking-wide dark:bg-zinc-800">
                {user.role}
              </span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </div>
      </div>
      {signOutError && (
        <p role="alert" className="mx-auto max-w-5xl px-6 pb-3 text-sm text-red-600">
          {signOutError}
        </p>
      )}
    </header>
  );
}
