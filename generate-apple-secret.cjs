/**
 * Generates an Apple Sign In client secret JWT for Supabase.
 *
 * Apple client secrets expire after at most 6 months. Run this script
 * whenever the current secret expires and paste the output into:
 *   Supabase Dashboard → Authentication → Providers → Apple → Secret Key
 *
 * Credentials sourced from:
 *   Team ID  : DEVELOPMENT_TEAM in ios/App/App.xcodeproj/project.pbxproj
 *   Key ID   : filename of the .p8 key downloaded from developer.apple.com
 *   Key file : ~/Downloads/AuthKey_<KEY_ID>.p8
 */

const jwt = require('/tmp/node_modules/jsonwebtoken');
const fs  = require('fs');
const path = require('path');

const TEAM_ID  = 'K3SNVHJ6L2';
const KEY_ID   = '8F9K69YBL4';
const CLIENT_ID = 'today.shakeapp.shakeapp'; // Apple Services ID (reverse bundle ID)
const KEY_PATH = path.join(process.env.HOME, 'Downloads', `AuthKey_${KEY_ID}.p8`);

const privateKey = fs.readFileSync(KEY_PATH, 'utf8');

const now        = Math.floor(Date.now() / 1000);
const SIX_MONTHS = 60 * 60 * 24 * 180;          // 180 days in seconds

const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + SIX_MONTHS,
  aud: 'https://appleid.apple.com',
  sub: CLIENT_ID,
};

const token = jwt.sign(payload, privateKey, {
  algorithm : 'ES256',
  keyid     : KEY_ID,
});

const expDate = new Date((now + SIX_MONTHS) * 1000).toISOString().split('T')[0];

console.log('\n=== Apple Sign In Client Secret ===');
console.log(token);
console.log(`\nExpires: ${expDate}`);
console.log('Paste this into: Supabase → Authentication → Providers → Apple → Secret Key\n');
