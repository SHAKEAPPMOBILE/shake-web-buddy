// Vercel serverless function — serves dynamic OG meta tags for WhatsApp/social previews.
// Route: /invite/:id  (rewritten here by vercel.json when ?_ param is absent)
//
// Crawlers (WhatsApp, Telegram, iMessage, etc.) get a full OG HTML page.
// Real users get a 302 to /invite/{id}?_=1 so the React SPA takes over.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const BASE_URL = "https://www.shakeapp.today";

const ACTIVITY_META = {
  dinner:  { label: "Dinner",  emoji: "🍽️",  image: `${BASE_URL}/icons/activities/dinner-icon.jpg`  },
  drinks:  { label: "Drinks",  emoji: "🍹",  image: `${BASE_URL}/icons/activities/drinks-icon.jpg`  },
  brunch:  { label: "Brunch",  emoji: "🥂",  image: `${BASE_URL}/icons/activities/brunch-icon.jpg`  },
  lunch:   { label: "Lunch",   emoji: "🥗",  image: `${BASE_URL}/icons/activities/lunch-icon.jpg`   },
  hike:    { label: "Hike",    emoji: "🥾",  image: `${BASE_URL}/icons/activities/hike-icon.jpg`    },
  sports:  { label: "Sports",  emoji: "⚽",  image: `${BASE_URL}/icons/activities/sports-icon.jpg`  },
};

const CRAWLER_UA = [
  "whatsapp", "telegram", "facebookexternalhit", "twitterbot", "linkedinbot",
  "slackbot", "discordbot", "googlebot", "bingbot", "applebot", "iMessageBot",
];

function isCrawler(userAgent = "") {
  const ua = userAgent.toLowerCase();
  return CRAWLER_UA.some((bot) => ua.includes(bot));
}

// User-created plans (activity_type "general") carry their title in `note`
// (e.g. "Beach time?") instead of a fixed dinner/brunch/drinks label. Use
// just its first word so it drops into "Join {word} in {city}!" the same
// way a fixed label does — capped so an unusually long word doesn't blow
// out the preview card.
const MAX_LABEL_WORD_LENGTH = 12;

function getFirstWordTruncated(text) {
  if (!text) return null;
  // Strip trailing punctuation (e.g. the comma in "Yoga, surf, dinner") so
  // it doesn't leak into "Join Yoga, in New York City!".
  const firstWord = text.trim().split(/\s+/)[0]?.replace(/[.,!?;:]+$/, "");
  if (!firstWord) return null;
  return firstWord.length > MAX_LABEL_WORD_LENGTH ? firstWord.slice(0, MAX_LABEL_WORD_LENGTH) : firstWord;
}

function resolveAvatarUrl(avatarUrl) {
  if (!avatarUrl) return null;
  return avatarUrl.startsWith("http") ? avatarUrl : `${BASE_URL}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
}

function buildOgHtml({ id, activityType, city, participantCount, note, creatorAvatarUrl }) {
  const meta = ACTIVITY_META[activityType] || { label: activityType, emoji: "🎉", image: `${BASE_URL}/shake-logo.png` };
  const customLabel = getFirstWordTruncated(note);
  const label = customLabel || meta.label;
  const emoji = customLabel ? "🎉" : meta.emoji;
  const image = resolveAvatarUrl(creatorAvatarUrl) || meta.image;
  const ogTitle = `${emoji} Join ${label} in ${city}!`;
  const ogDesc = participantCount > 0
    ? `${participantCount} ${participantCount === 1 ? "person" : "people"} already joined ${label} in ${city}. Join them on SHAKE!`
    : `Someone's organising ${label} in ${city}. Join them on SHAKE!`;
  const appUrl = `${BASE_URL}/invite/${id}?_=1`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${ogTitle}</title>

  <meta property="og:type"        content="website" />
  <meta property="og:url"         content="${BASE_URL}/invite/${id}" />
  <meta property="og:title"       content="${ogTitle}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:image"       content="${image}" />
  <meta property="og:image:width"  content="800" />
  <meta property="og:image:height" content="800" />
  <meta property="og:site_name"   content="SHAKE" />

  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDesc}" />
  <meta name="twitter:image"       content="${image}" />

  <meta http-equiv="refresh" content="0; url=${appUrl}" />
</head>
<body>
  <script>window.location.replace("${appUrl}")</script>
  <p>Redirecting… <a href="${appUrl}">Open SHAKE</a></p>
</body>
</html>`;
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    res.status(400).send("Bad request");
    return;
  }

  const ua = req.headers["user-agent"] || "";

  // Real users → redirect straight to the SPA route (bypasses this function via ?_=1).
  if (!isCrawler(ua)) {
    res.setHeader("Location", `/invite/${id}?_=1`);
    res.status(302).end();
    return;
  }

  // Crawlers → fetch activity and return OG HTML.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Fallback: minimal OG page pointing to the app.
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).send(buildOgHtml({ id, activityType: "dinner", city: "", participantCount: 0 }));
    return;
  }

  try {
    const actRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_activities?id=eq.${encodeURIComponent(id)}&is_active=eq.true&select=id,activity_type,city,note,user_id&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );

    const actData = actRes.ok ? await actRes.json() : null;
    const activity = Array.isArray(actData) && actData.length > 0 ? actData[0] : null;

    if (!activity) {
      res.setHeader("Cache-Control", "s-maxage=30");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(404).send(`<!DOCTYPE html><html><head><meta property="og:title" content="Activity not found" /><meta property="og:image" content="${BASE_URL}/shake-logo.png" /></head><body><script>window.location.replace("${BASE_URL}")</script></body></html>`);
      return;
    }

    const [countRes, profileRes] = await Promise.allSettled([
      fetch(
        `${SUPABASE_URL}/rest/v1/activity_joins?activity_id=eq.${encodeURIComponent(id)}&select=id`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Prefer: "count=exact", Range: "0-0" } }
      ),
      activity.user_id
        ? fetch(
            `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(activity.user_id)}&select=avatar_url&limit=1`,
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
          )
        : Promise.resolve(null),
    ]);

    // Parse participant count from Content-Range header (e.g. "0-0/5" → 5).
    let participantCount = 0;
    if (countRes.status === "fulfilled" && countRes.value.ok) {
      const range = countRes.value.headers.get("content-range") || "";
      const match = range.match(/\/(\d+)$/);
      if (match) participantCount = parseInt(match[1], 10);
    }

    let creatorAvatarUrl = null;
    if (profileRes.status === "fulfilled" && profileRes.value && profileRes.value.ok) {
      const profileData = await profileRes.value.json();
      creatorAvatarUrl = Array.isArray(profileData) && profileData.length > 0 ? profileData[0].avatar_url : null;
    }

    const html = buildOgHtml({
      id,
      activityType: activity.activity_type,
      city: activity.city,
      participantCount,
      note: activity.note,
      creatorAvatarUrl,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).send(html);
  } catch (err) {
    console.error("share-og error:", err);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send(`<!DOCTYPE html><html><head><meta property="og:title" content="SHAKE" /><meta property="og:image" content="${BASE_URL}/shake-logo.png" /><meta http-equiv="refresh" content="0; url=${BASE_URL}" /></head><body></body></html>`);
  }
}
