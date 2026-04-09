#!/usr/bin/env node
/**
 * One-off test: sign in with phone + password using the same Supabase auth the app uses.
 * Run: TEST_PASSWORD=yourpassword node --env-file=.env scripts/test-login.mjs [+573223140283]
 * Uses VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env.
 * If login fails, confirm in Supabase Dashboard → Authentication → Users that the user
 * exists and the phone value matches (e.g. +573223140283 for Colombia).
 */

const phone = process.argv[2] || process.env.TEST_PHONE || "+573223140283";
const password = process.env.TEST_PASSWORD;

if (!password) {
  console.error("Set TEST_PASSWORD (e.g. TEST_PASSWORD=xxx node --env-file=.env scripts/test-login.mjs)");
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

// So you can confirm we're hitting the right project (Supabase Dashboard → Auth → Users)
const projectRef = url.replace(/https:\/\//, "").split(".")[0];
console.log("Supabase project:", projectRef ? `${projectRef}.supabase.co` : "(check .env)");

const { createClient } = await import("@supabase/supabase-js");

const supabase = createClient(url, key, { auth: { persistSession: false } });

const phoneE164 = phone.replace(/\s/g, "");
console.log("Attempting sign in with phone:", phone.replace(/\d(?=\d{4})/g, "*"));

// Try E.164 with + first; some projects store without +
const toTry = [phoneE164, phoneE164.replace(/^\+/, "")].filter((v, i, a) => a.indexOf(v) === i);

let data, error;
for (const p of toTry) {
  const res = await supabase.auth.signInWithPassword({ phone: p, password });
  data = res.data;
  error = res.error;
  if (!error) break;
}

if (error) {
  console.log("Result: ERROR");
  console.log("Message:", error.message);
  console.log("Status:", error.status);
  process.exit(1);
}

console.log("Result: SUCCESS");
console.log("User id:", data.user?.id);
process.exit(0);
