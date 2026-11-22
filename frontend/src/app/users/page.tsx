"use client";

import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import { PageStatus } from "@/components/PageStatus";
import { UserCreateForm } from "@/components/UserCreateForm";
import { UserTable } from "@/components/UserTable";
import { ApiError, fetchUsers, type User, type UserSummary } from "@/lib/api";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

/** The user list, or null when the API says the signed-in user is not an admin (403). */
async function loadUsers(): Promise<UserSummary[] | null> {
  try {
    return await fetchUsers();
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) return null;
    throw err;
  }
}

function AdminsOnly({ user }: Readonly<{ user: User }>) {
  return (
    <div className="min-h-screen">
      <AppHeader user={user} />

      <main className="mx-auto max-w-5xl space-y-3 p-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p role="alert">Only admins can manage users.</p>
        <Link href="/products" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          Back to products
        </Link>
      </main>
    </div>
  );
}

export default function UsersPage() {
  const { state, setData, signOut } = useAuthedLoad(loadUsers);

  if (state.status === "loading") return <PageStatus message="Loading users..." />;
  if (state.status === "error") return <PageStatus message={state.message} error />;
  // Staff can reach this URL (a bookmark, a shared link); don't leave them at a dead end.
  if (state.data === null) return <AdminsOnly user={state.user} />;

  function replaceUser(updated: UserSummary) {
    setData((users) => users && users.map((user) => (user.id === updated.id ? updated : user)));
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
            onCreated={(user) => setData((users) => users && [...users, user])}
            onUnauthorized={signOut}
          />
        </section>

        <UserTable
          users={state.data}
          currentUserId={state.user.id}
          onChanged={replaceUser}
          onUnauthorized={signOut}
        />
      </main>
    </div>
  );
}
