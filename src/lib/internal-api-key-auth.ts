export type InternalKeyMatch = "current" | "previous" | null;

export function matchInternalApiKey(presented: string | null | undefined): InternalKeyMatch {
  const current = process.env.INTERNAL_API_KEY;
  const previous = process.env.INTERNAL_API_KEY_PREVIOUS;
  if (!current && !previous) return null; // fail-closed: no expected key configured
  if (!presented) return null;
  if (current && presented === current) return "current";
  if (previous && presented === previous) {
    console.warn(
      "[internal-api-key] request authenticated with INTERNAL_API_KEY_PREVIOUS (rotation in progress)"
    );
    return "previous";
  }
  return null;
}
