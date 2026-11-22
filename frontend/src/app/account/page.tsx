"use client";

import { AppHeader } from "@/components/AppHeader";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { PageStatus } from "@/components/PageStatus";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

const noPageData = () => Promise.resolve(null);

export default function AccountPage() {
  const { state, signOut } = useAuthedLoad(noPageData);

  if (state.status === "loading") return <PageStatus message="Loading account..." />;
  if (state.status === "error") return <PageStatus message={state.message} error />;

  return (
    <div className="min-h-screen">
      <AppHeader user={state.user} />

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Account</h1>
          <p className="text-sm text-zinc-500">
            Signed in as {state.user.username} ({state.user.role})
          </p>
        </div>

        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Change password</h2>
          <ChangePasswordForm token={state.token} onUnauthorized={signOut} />
        </section>
      </main>
    </div>
  );
}
