import { EMOJI_INDEX } from "@/data/emojiIndex";

/**
 * "Whatever people say" → the closest emoji, for plans whose title isn't one of the activity types
 * that have their own illustrated icon (yoga, picnic, coffee, …). English and Spanish.
 *
 * Order: a short curated list for things Unicode has no good word for (padel, parrillada, salsa…),
 * then a search over every activity/food/place/object emoji's name and tags. The search weighs a
 * word by how rare it is across emoji — "pong" points straight at 🏓, "game" (on 40 of them) points
 * at nothing — and returns null rather than guess, so an unrecognised title simply gets no emoji.
 */

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// Words that say nothing about WHAT the activity is.
const STOP = new Set(
  (
    "the and with for from that this have has are was were you your our their its not but all any one two let lets come join meet meetup hang hangout out time night tonight today tomorrow " +
    "morning evening afternoon weekend week plan plans friend friends people anyone everyone group new free fun good best big little nice great day days please more some here there want need " +
    "going make make get got take like love just only very really some sunday monday tuesday wednesday thursday friday saturday january february march april june july august september october november december " +
    "para con los las una uno unos unas del que por sin hoy manana noche tarde amigo amigos amiga amigas grupo gente nuevo nueva gratis divertido venir unete vamos queremos quien quienes todos todas " +
    "leo domingo lunes martes miercoles jueves viernes sabado enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre club clase class"
  ).split(" "),
);

// Things the emoji names don't cover (or cover under the wrong word). Tested on accent-free text.
const CURATED: [RegExp, string][] = [
  [/\b(beer ?pong|cerveza ?pong)\b/, "🍺"],
  [/\b(ping ?pong|tenis de mesa|table tennis)\b/, "🏓"],
  [/\b(dog|dogs|perro|perros|puppy)\b/, "🐕"], // before walking: "dog walk" is a dog thing
  [/\b(art|arte|paint|painting|pintura|pintar|draw|drawing|dibujo|dibujar)\b/, "🎨"],
  [/\b(pottery|ceramic|ceramics|ceramica)\b/, "🏺"],
  [/\b(market|markets|mercado|flea|feria|thrift|thrifting|vintage)\b/, "🛍️"],
  [/\b(trivia|quiz)\b/, "🧠"],
  [/\b(karting|kart|go ?kart|gokart)\b/, "🏎️"],
  [/\b(paintball|laser tag|airsoft)\b/, "🎯"],
  [/\b(stargazing|astronomy|astronomia|telescope|telescopio)\b/, "🔭"],
  [/\b(bonfire|campfire|fogata)\b/, "🔥"],
  [/\b(golf|minigolf)\b/, "⛳"],
  [/\b(open mic|standup|stand up|comedy|comedia)\b/, "🎤"],
  [/\b(salsa|bachata|merengue|baile|bailar|bailando|dance|dancing|dancer)\b/, "💃"],
  [/\b(padel|pickleball|tennis|tenis)\b/, "🎾"],
  [/\b(crossfit|gym|gimnasio|workout|entrenamiento|entrenar|fitness|pesas)\b/, "🏋️"],
  [/\b(bbq|barbecue|barbacoa|asado|parrilla|parrillada|grill)\b/, "🍖"],
  [/\b(poker|cartas|baraja)\b/, "🃏"],
  [/\b(chess|ajedrez)\b/, "♟️"],
  [/\b(board ?games?|juegos de mesa)\b/, "🎲"],
  [/\b(language exchange|intercambio|idiomas|english practice)\b/, "🗣️"],
  [/\b(networking|coworking|cowork|emprendedores|startups?)\b/, "💼"],
  [/\b(book club|club de lectura|lectura|libros|reading)\b/, "📚"],
  [/\b(photo|photos|photography|fotos|fotografia)\b/, "📷"],
  [/\b(cooking|cocinar|cocina)\b/, "🍳"],
  [/\b(concert|concierto|live music|musica en vivo|festival)\b/, "🎶"],
  [/\b(party|fiesta|parche|rumbear|rumba)\b/, "🎉"],
  [/\b(hike|hiking|senderismo|caminata|trekking|trek)\b/, "🥾"],
  [/\b(run|running|correr|trotar|jogging)\b/, "🏃"],
  [/\b(swim|swimming|natacion|nadar|piscina)\b/, "🏊"],
  [/\b(football|futbol|soccer|futbolito|microfutbol)\b/, "⚽"],
  [/\b(basketball|basket|baloncesto|basquet)\b/, "🏀"],
  [/\b(volleyball|voleibol|voley)\b/, "🏐"],
  [/\b(skate|skating|skateboard|patinar|patinaje|patines)\b/, "🛹"],
  [/\b(pilates|stretching|estiramiento|barre)\b/, "🤸"],
  [/\b(gardening|garden|jardin|jardineria|huerta)\b/, "🌱"],
  [/\b(fishing|angling|pesca|pescar)\b/, "🎣"],
  [/\b(boxing|boxeo|kickboxing|muay thai|mma)\b/, "🥊"],
  [/\b(spinning|spin class|zumba)\b/, "🚴"],
  [/\b(climb|climbing|escalada|boulder|bouldering)\b/, "🧗"],
  [/\b(meditation|meditar|meditacion|mindfulness)\b/, "🧘"],
  [/\b(walk|walking|caminar|paseo|stroll)\b/, "🚶"],

];

interface Index {
  emoji: string[];
  label: Map<string, number[]>;
  tag: Map<string, number[]>;
  df: Map<string, number>;
}

let index: Index | null = null;
function build(): Index {
  const idx: Index = { emoji: [], label: new Map(), tag: new Map(), df: new Map() };
  EMOJI_INDEX.forEach(([emoji, labels, tags], i) => {
    idx.emoji.push(emoji);
    const seen = new Set<string>();
    for (const w of labels.split(" ")) {
      if (!w) continue;
      (idx.label.get(w) ?? idx.label.set(w, []).get(w)!).push(i);
      seen.add(w);
    }
    for (const w of tags ? tags.split(" ") : []) {
      if (!w) continue;
      (idx.tag.get(w) ?? idx.tag.set(w, []).get(w)!).push(i);
      seen.add(w);
    }
    seen.forEach((w) => idx.df.set(w, (idx.df.get(w) ?? 0) + 1));
  });
  return idx;
}

// "running" → running, runn, run; "tacos" → tacos, taco.
function variants(w: string): string[] {
  const v = [w];
  if (w.endsWith("ing") && w.length > 5) v.push(w.slice(0, -3), w.slice(0, -3) + "e");
  if (w.endsWith("es") && w.length > 4) v.push(w.slice(0, -2));
  if (w.endsWith("s") && w.length > 3) v.push(w.slice(0, -1));
  if (w.endsWith("ed") && w.length > 4) v.push(w.slice(0, -2), w.slice(0, -1));
  return v;
}

const MIN_SCORE = 0.9;

/** The best emoji for what someone typed, or null when nothing in it is specific enough. */
export function findEmojiForText(text: string | null | undefined): string | null {
  const t = norm(text ?? "");
  if (!t) return null;

  for (const [re, emoji] of CURATED) if (re.test(t)) return emoji;

  const idx = (index ??= build());
  const tokens = t.split(" ").filter((w) => w.length >= 3 && !STOP.has(w));
  const scores = new Map<number, number>();
  for (const tok of tokens) {
    for (const v of variants(tok)) {
      const inLabel = idx.label.get(v);
      const inTag = idx.tag.get(v);
      if (!inLabel && !inTag) continue;
      const rarity = 1 / Math.pow(idx.df.get(v) ?? 1, 0.75);
      inLabel?.forEach((i) => scores.set(i, (scores.get(i) ?? 0) + 3 * rarity));
      inTag?.forEach((i) => scores.set(i, (scores.get(i) ?? 0) + 1 * rarity));
      break; // the first form of this word that exists is the one we mean
    }
  }
  let best = -1;
  let bestScore = 0;
  scores.forEach((s, i) => {
    // Ties go to the earlier (more common) emoji in Unicode order.
    if (s > bestScore || (s === bestScore && i < best)) {
      best = i;
      bestScore = s;
    }
  });
  return best >= 0 && bestScore >= MIN_SCORE ? idx.emoji[best] : null;
}
