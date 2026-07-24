/**
 * Detects names that were auto-generated from an email's local-part rather
 * than actually entered by the user (e.g. "leoneltelesmeneses+shake16" from
 * "leoneltelesmeneses+shake16@gmail.com"). Profiles have occasionally ended
 * up with a name like this written by a code path that falls back to the
 * email prefix — a truthy name there makes downstream completeness checks
 * treat onboarding as done and skip the question wizard entirely.
 *
 * Used as a defensive guard in the profile-completeness checks so the
 * wizard reliably re-triggers for anyone with a name matching this pattern,
 * regardless of which write path produced it.
 */
export function isEmailPrefixName(name: string | null | undefined, email: string | null | undefined): boolean {
  if (!name || !email) return false;
  const localPart = email.split("@")[0]?.trim().toLowerCase();
  if (!localPart) return false;
  return name.trim().toLowerCase() === localPart;
}
