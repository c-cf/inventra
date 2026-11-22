"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoginForm } from "@/components/LoginForm";
import { fetchMe } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Already signed in (the session cookie is valid)? Skip the form.
    let cancelled = false;
    fetchMe().then(
      () => {
        if (!cancelled) router.replace("/products");
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Inventra</h1>
          <p className="text-sm text-zinc-500">Sign in to manage orders and inventory.</p>
        </div>
        <LoginForm
          onSuccess={() => router.push("/products")}
        />
      </div>
    </main>
  );
}
