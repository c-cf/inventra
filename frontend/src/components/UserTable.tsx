"use client";

import { useState } from "react";

import { ApiError, type Role, ROLES, updateUserRole, type UserSummary } from "@/lib/api";

type UserTableProps = {
  token: string;
  users: UserSummary[];
  currentUserId: number;
  onChanged: (user: UserSummary) => void;
  onUnauthorized: () => void;
};

export function UserTable({
  token,
  users,
  currentUserId,
  onChanged,
  onUnauthorized,
}: Readonly<UserTableProps>) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(user: UserSummary, role: Role) {
    setError(null);
    setPendingId(user.id);
    try {
      onChanged(await updateUserRole(token, user.id, role));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Is the backend running?",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th scope="col" className="px-4 py-3">Username</th>
              <th scope="col" className="px-4 py-3">Role</th>
              <th scope="col" className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    {user.username}
                    {isSelf && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Role for ${user.username}`}
                      value={user.role}
                      disabled={isSelf || pendingId === user.id}
                      onChange={(e) => void changeRole(user, e.target.value as Role)}
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{user.created_at}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
