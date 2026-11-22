"use client";

import { type FormEvent, useState } from "react";

import { ApiError, createUser, type Role, ROLES, type UserSummary } from "@/lib/api";
import { newPasswordProblem } from "@/lib/passwords";

type UserCreateFormProps = {
  token: string;
  onCreated: (user: UserSummary) => void;
  onUnauthorized: () => void;
};

// Mirrors UserCreate in the API (backend/app/schemas/auth.py).
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function validate(username: string, password: string): string | null {
  if (username.length < 3 || username.length > 150) return "Username must be 3 to 150 characters.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Username may only use letters, digits, '.', '_' and '-'.";
  }
  return newPasswordProblem(password);
}

export function UserCreateForm({ token, onCreated, onUnauthorized }: Readonly<UserCreateFormProps>) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = username.trim();
    const problem = validate(name, password);
    setError(problem);
    if (problem) return;

    setPending(true);
    try {
      onCreated(await createUser(token, { username: name, password, role }));
      setUsername("");
      setPassword("");
      setRole("staff");
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
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end" noValidate>
      <div className="space-y-1">
        <label htmlFor="new-username" className="block text-sm font-medium">
          Username
        </label>
        <input
          id="new-username"
          autoComplete="off"
          className={inputClass}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="new-user-password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="new-user-password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="new-user-role" className="block text-sm font-medium">
          Role
        </label>
        <select
          id="new-user-role"
          className={inputClass}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create user"}
      </button>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-4 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      )}
    </form>
  );
}
