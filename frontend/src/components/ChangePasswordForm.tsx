"use client";

import { type FormEvent, useState } from "react";

import { ApiError, changePassword } from "@/lib/api";
import { newPasswordProblem } from "@/lib/passwords";

type ChangePasswordFormProps = {
  onUnauthorized: () => void;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function validate(current: string, next: string, confirm: string): string | null {
  if (current === "") return "Enter your current password.";
  const problem = newPasswordProblem(next, "New password");
  if (problem) return problem;
  if (next !== confirm) return "The new passwords do not match.";
  return null;
}

export function ChangePasswordForm({ onUnauthorized }: Readonly<ChangePasswordFormProps>) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDone(false);

    const problem = validate(current, next, confirm);
    setError(problem);
    if (problem) return;

    setPending(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
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

  const fields = [
    { id: "current-password", label: "Current password", value: current, set: setCurrent, auto: "current-password" },
    { id: "new-password", label: "New password", value: next, set: setNext, auto: "new-password" },
    { id: "confirm-password", label: "Confirm new password", value: confirm, set: setConfirm, auto: "new-password" },
  ];

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4" noValidate>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <label htmlFor={field.id} className="block text-sm font-medium">
            {field.label}
          </label>
          <input
            id={field.id}
            type="password"
            autoComplete={field.auto}
            className={inputClass}
            value={field.value}
            onChange={(e) => field.set(e.target.value)}
          />
        </div>
      ))}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Password changed.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
