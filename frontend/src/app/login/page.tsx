"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoginForm } from "@/components/LoginForm";
import { getToken, setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) router.replace("/products");
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Inventra</h1>
          <p className="text-sm text-zinc-500">Sign in to manage orders and inventory.</p>
        </div>
        <LoginForm
          onSuccess={(token) => {
            setToken(token);
            router.push("/products");
          }}
        />
      </div>
    </main>
  );
}
