// Mirrors check_password_strength in the API (backend/app/schemas/auth.py).
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72; // bcrypt reads at most 72 bytes

/** Why a new password would be rejected by the API, or null when it is fine. */
export function newPasswordProblem(password: string, label = "Password"): string | null {
  if ([...password].length < MIN_PASSWORD_LENGTH) {
    return `${label} must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `${label} must be at most ${MAX_PASSWORD_BYTES} bytes.`;
  }
  return null;
}
