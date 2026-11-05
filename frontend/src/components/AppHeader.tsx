"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { User } from "@/lib/api";
import { clearToken } from "@/lib/auth";

type AppHeaderProps = {
  user: User | null;
};

export function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter();

  function signOut() {
    clearToken();
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
        </nav>
        <div className="flex items-center gap-4 text-sm">
          {user && (
            <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <span>{user.username}</span>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs uppercase tracking-wide dark:bg-zinc-800">
                {user.role}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
