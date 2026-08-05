/** Shared username rules: 3-20 chars, lowercase letters/numbers/underscores. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

export function usernameError(username: string): string | null {
  if (username.length < 3) return "At least 3 characters.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Lowercase letters, numbers and underscores only.";
  }
  return null;
}
