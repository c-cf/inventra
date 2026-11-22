"use client";

import { AppHeader } from "@/components/AppHeader";
import { PageStatus } from "@/components/PageStatus";
import { UserCreateForm } from "@/components/UserCreateForm";
import { UserTable } from "@/components/UserTable";
import { fetchUsers, type UserSummary } from "@/lib/api";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

export default function UsersPage() {
  // Staff get a 403 from the API, which shows up here as the error state.
  const { state, setData, signOut } = useAuthedLoad((token) => fetchUsers(token));

  if (state.status === "loading") return <PageStatus message="Loading users..." />;
  if (state.status === "error") return <PageStatus message={state.message} error />;

  function replaceUser(updated: UserSummary) {
    setData((users) => users.map((user) => (user.id === updated.id ? updated : user)));
  }

  return (
    <div className="min-h-screen">
      <AppHeader user={state.user} />

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-zinc-500">
            Admins manage accounts. Staff can work with products, stock and orders but cannot
            delete products or manage users.
          </p>
        </div>

        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Add a user</h2>
          <UserCreateForm
            token={state.token}
            onCreated={(user) => setData((users) => [...users, user])}
            onUnauthorized={signOut}
          />
        </section>

        <UserTable
          token={state.token}
          users={state.data}
          currentUserId={state.user.id}
          onChanged={replaceUser}
          onUnauthorized={signOut}
        />
      </main>
    </div>
  );
}
