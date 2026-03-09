#!/usr/bin/env node
/**
 * Verifies that technical auth errors are mapped to user-friendly messages.
 * Run: node scripts/test-auth-error-messages.mjs
 */

function toFriendlyAuthMessage(raw, context) {
  const lower = (raw || "").toLowerCase();
  const isTechnical =
    lower.includes("load failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("edge function") ||
    lower.includes("non-2xx") ||
    lower.includes("network request failed");
  if (isTechnical) {
    if (context === "login") return "Unable to sign in. Please check your connection and try again.";
    if (context === "otp") return "Something went wrong. Please check your connection and try again.";
    if (context === "forgot") return "Unable to continue. Please check your connection and try again.";
    return "Something went wrong. Please try again.";
  }
  return raw || "Something went wrong. Please try again.";
}

const cases = [
  ["Load failed", "login", "Unable to sign in. Please check your connection and try again."],
  ["Load failed", "otp", "Something went wrong. Please check your connection and try again."],
  ["Edge Function returned a non-2xx status code", "login", "Unable to sign in. Please check your connection and try again."],
  ["Edge Function returned a non-2xx status code", "otp", "Something went wrong. Please check your connection and try again."],
  ["Failed to fetch", "login", "Unable to sign in. Please check your connection and try again."],
  ["NetworkError", "forgot", "Unable to continue. Please check your connection and try again."],
  ["Invalid login credentials", "login", "Invalid login credentials"],
];

let failed = 0;
for (const [raw, context, expected] of cases) {
  const got = toFriendlyAuthMessage(raw, context);
  if (got !== expected) {
    console.error(`FAIL: toFriendlyAuthMessage(${JSON.stringify(raw)}, ${context})\n  expected: ${JSON.stringify(expected)}\n  got:      ${JSON.stringify(got)}`);
    failed++;
  }
}
if (failed) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log("OK: All auth error message mappings passed.");
