import { EMOJI_INDEX } from "@/data/emojiIndex";
import { EMOJI_LANG_LOADERS } from "@/data/emojiLangLoaders";

/**
 * "Whatever people say" → the closest emoji, for plans whose title isn't one of the activity types
 * that have their own illustrated icon (yoga, picnic, coffee, …). English and Spanish.
 *
 * Languages: English and Spanish are always loaded (they're in the main bundle). The same emoji's
 * names in 39 more languages are one small lazy chunk each (8–21 KB), and only the languages a
 * person actually uses are fetched: their app language, their device languages, and — the moment they
 * type in a script that identifies a language (Greek letters, Hangul, Arabic…) — that language.
 * Each language is searched on its own words; they are not pooled, because words collide across
 * languages ("vivo" is Spanish "live" and Hungarian "fencer"). Components subscribe through
 * useEmojiSearchVersion() so they re-evaluate when a language lands.
 *
 * Order: a short curated list for things Unicode has no good word for (padel, parrillada, salsa…),
 * then a search over every activity/food/place/object emoji's name and tags. The search weighs a
 * word by how rare it is across emoji — "pong" points straight at 🏓, "game" (on 40 of them) points
 * at nothing — and returns null rather than guess, so an unrecognised title simply gets no emoji.
 */

// Strips Latin diacritics only (U+0300–036F) and keeps every letter, mark and digit of any script, so
// "Café" → "cafe" while Arabic, Hindi or Thai words stay intact. Must match the generator exactly.
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// Scripts written without spaces between words (or glued with particles): matched by scanning for
// known words inside the text instead of by whole tokens.
const SUBSCRIPT_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
// Anything non-Latin: the cue to fetch the second language chunk.
const NON_LATIN_RE = /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Thai}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

// Words that say nothing about WHAT the activity is.
const STOP = new Set(
  (
    "the and with for from that this have has are was were you your our their its not but all any one two let lets come join meet meetup hang hangout out time night tonight today tomorrow " +
    "morning evening afternoon weekend week plan plans friend friends people anyone everyone group new free fun good best big little nice great day days please more some here there want need " +
    "going make make get got take like love just only very really some sunday monday tuesday wednesday thursday friday saturday january february march april june july august september october november december " +
    "para con los las una uno unos unas del que por sin hoy manana noche tarde amigo amigos amiga amigas grupo gente nuevo nueva gratis divertido venir unete vamos queremos quien quienes todos todas " +
    "leo domingo lunes martes miercoles jueves viernes sabado enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre club clase class " +
    "com uma uns umas dos das por sem hoje amanha noite manha amigos amigas pessoas novo nova gratis vamos segunda terca quarta quinta sexta aula " +
    "pour avec les des une aux sur sans aujourd hui demain soir matin amis amie amies gens nouveau nouvelle gratuit cours lundi mardi mercredi jeudi vendredi samedi dimanche " +
    "und mit der die das ein eine einen fur von zum zur heute morgen abend freunde freund neu kostenlos kurs montag dienstag mittwoch donnerstag freitag samstag sonntag " +
    "per con gli dei del della delle dal dalla nel nella col alle uno che senza vivo oggi domani sera mattina amici amico amica gente nuovo corso lunedi martedi mercoledi giovedi venerdi sabato domenica"
  ).split(" "),
);

// Things the emoji names don't cover (or cover under the wrong word). Tested on accent-free text.
const CURATED: [RegExp, string][] = [
  // The most common social plans, in the languages the cities speak. The general search covers the long
  // tail, but with 40 languages in one word pool a few words collide across them ("vivo" is Spanish
  // "live" and Hungarian "fencer"), and "live music" is too common a plan to leave to chance.
  [/\b(musica (?:en|ao|dal) vivo|musique (?:live|en direct)|live ?musik|live muziek|muzyka na zywo|canli muzik|konzert|concerto|concierto|concert)\b/, "🎶"],
  [/\b(jogos de tabuleiro|jeux de societe|brettspiele|gesellschaftsspiele|giochi da tavolo|bordspellen|brettspill|sallskapsspel)\b/, "🎲"],
  [/\b(clube do livro|clube de leitura|club de lecture|buchclub|lesekreis|club del libro|club di lettura|boekenclub|leesclub)\b/, "📚"],
  [/\b(aula de culinaria|curso de culinaria|cours de cuisine|atelier cuisine|kochkurs|corso di cucina|kookworkshop|kookcursus)\b/, "🍳"],
  [/\b(degustacao de vinhos?|prova de vinhos?|degustation de vins?|weinprobe|weinverkostung|degustazione di vini|wijnproeverij|cata de vinos?|vinprovning)\b/, "🍷"],
  [/\b(passear o cao|promener le chien|gassi|spaziergang mit hund|passeggiata col cane|hond uitlaten|pasear al perro)\b/, "🐕"],
  [/\b(caminhada|randonnee|wandern|wanderung|escursione|escursionismo|wandelen|trilha)\b/, "🥾"],
  [/\b(corrida|course a pied|joggen|laufen|corsa|hardlopen)\b/, "🏃"],
  [/\b(natacao|natation|schwimmen|nuoto|zwemmen|simning)\b/, "🏊"],
  [/\b(escalada|escalade|klettern|arrampicata|klimmen)\b/, "🧗"],
  [/\b(tenis de mesa|tennis de table|tischtennis|tennis da tavolo|tafeltennis|masa tenisi|tenis meja)\b/, "🏓"],
  [/\b(churrasco|grillen|grigliata|grillfest)\b/, "🍖"],
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
  /** Tags from the extra languages. Those keyword lists are looser than English/Spanish's ("vivo" on a
   *  fencer), so words shorter than 5 letters are ignored there (CJK/Thai words are exempt). */
  tagMore: Map<string, number[]>;
  /** Same, for scripts matched by scanning (CJK, Thai, Hangul). */
  subLabel: Map<string, number[]>;
  subTag: Map<string, number[]>;
  subTagMore: Map<string, number[]>;
  subMaxLen: number;
  /** Words of the compounding languages that are loaded (German, Dutch, Nordic…) — the only ones allowed to
   *  match inside a longer word, otherwise "dégustation" finds "station" in English. */
  cLabel: Map<string, number[]>;
  cTag: Map<string, number[]>;
  /** Every token-script word, sorted — for prefix matching ("klettern" → "kletternder"). */
  sorted: string[];
  /** How many emoji each word appears on — the denominator for "how rare is this word". */
  df: Map<string, number>;
}

type ExtraRows = [string, string][];
const loadedLangs = new Map<string, ExtraRows>();
// Languages that glue words together, so a long unknown word may contain known ones.
const COMPOUNDING = new Set(["de", "nl", "sv", "da", "nb", "fi", "hu", "et"]);
let index: Index | null = null;

function push(map: Map<string, number[]>, word: string, i: number) {
  const list = map.get(word);
  if (list) list.push(i);
  else map.set(word, [i]);
}

function build(): Index {
  const idx: Index = { emoji: [], label: new Map(), tag: new Map(), tagMore: new Map(), subLabel: new Map(), subTag: new Map(), subTagMore: new Map(), subMaxLen: 2, cLabel: new Map(), cTag: new Map(), sorted: [], df: new Map() };
  EMOJI_INDEX.forEach(([emoji, labels, tags], i) => {
    idx.emoji.push(emoji);
    const seen = new Set<string>();
    const add = (word: string, isLabel: boolean, more = false, compound = false) => {
      if (!word) return;
      if (more && !isLabel && word.length < 5 && !SUBSCRIPT_RE.test(word)) return;
      if (compound && word.length >= 4 && !SUBSCRIPT_RE.test(word)) push(isLabel ? idx.cLabel : idx.cTag, word, i);
      if (SUBSCRIPT_RE.test(word)) {
        push(isLabel ? idx.subLabel : more ? idx.subTagMore : idx.subTag, word, i);
        if (word.length > idx.subMaxLen) idx.subMaxLen = Math.min(word.length, 10);
      } else {
        push(isLabel ? idx.label : more ? idx.tagMore : idx.tag, word, i);
      }
      seen.add(word);
    };
    labels.split(" ").forEach((w) => add(w, true));
    if (tags) tags.split(" ").forEach((w) => add(w, false));
    for (const [code, rows] of loadedLangs) {
      const row = rows[i];
      if (!row) continue;
      const compound = COMPOUNDING.has(code);
      if (row[0]) row[0].split(" ").forEach((w) => add(w, true, false, compound));
      if (row[1]) row[1].split(" ").forEach((w) => add(w, false, true, compound));
    }
    seen.forEach((w) => idx.df.set(w, (idx.df.get(w) ?? 0) + 1));
  });
  idx.sorted = [...idx.df.keys()].filter((w) => !SUBSCRIPT_RE.test(w)).sort();
  return idx;
}

// ── Lazy language chunks + a version number components can subscribe to ───────────────────────
let version = 0;
const listeners = new Set<() => void>();
export const subscribeEmojiSearch = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const getEmojiSearchVersion = () => version;

const requestedLangs = new Set<string>();

/** Maps a locale tag ("pt-BR", "zh-TW", "iw") to one of our language chunks, or null when it's English,
 *  Spanish (always loaded) or something we have no data for. */
export function normalizeEmojiLang(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const t = tag.toLowerCase().replace("_", "-");
  let code: string;
  if (t.startsWith("zh")) code = /^zh-(tw|hk|mo|hant)/.test(t) ? "zh-hant" : "zh";
  else if (t === "no" || t.startsWith("nb") || t.startsWith("nn")) code = "nb";
  else if (t === "iw") code = "he";
  else if (t === "in") code = "id";
  else code = t.split("-")[0];
  return code in EMOJI_LANG_LOADERS ? code : null;
}

/** Fetches the word lists for these languages (once each). Resolves when they're searchable. */
export function ensureEmojiLanguages(tags: (string | null | undefined)[]): Promise<void> {
  const loads: Promise<void>[] = [];
  for (const tag of tags) {
    const code = normalizeEmojiLang(tag);
    if (!code || requestedLangs.has(code)) continue;
    requestedLangs.add(code);
    loads.push(
      EMOJI_LANG_LOADERS[code]()
        .then((m) => {
          loadedLangs.set(code, m.default);
          index = null; // rebuilt with the new words on the next search
          version++;
          listeners.forEach((cb) => cb());
        })
        .catch(() => {
          requestedLangs.delete(code); // offline / chunk failed: allow a retry on the next trigger
        }),
    );
  }
  return Promise.all(loads).then(() => undefined);
}

/**
 * Loads the languages this person is likely to type in: the first few of their app language and device
 * languages. Three at most — each one added is more words that can collide with the others.
 */
export function initEmojiLanguages(preferred: (string | null | undefined)[]): Promise<void> {
  const picked: string[] = [];
  for (const tag of preferred) {
    const code = normalizeEmojiLang(tag);
    if (code && !picked.includes(code)) picked.push(code);
    if (picked.length >= 3) break;
  }
  return ensureEmojiLanguages(picked);
}

// Scripts that identify a language (or a short list of them) on their own.
const SCRIPT_LANGS: [RegExp, string[]][] = [
  [/\p{Script=Greek}/u, ["el"]],
  [/\p{Script=Hebrew}/u, ["he"]],
  [/\p{Script=Arabic}/u, ["ar", "fa"]],
  [/\p{Script=Cyrillic}/u, ["ru", "uk", "bg", "sr"]],
  [/\p{Script=Devanagari}/u, ["hi"]],
  [/\p{Script=Bengali}/u, ["bn"]],
  [/\p{Script=Thai}/u, ["th"]],
  [/\p{Script=Hangul}/u, ["ko"]],
  [/[\p{Script=Hiragana}\p{Script=Katakana}]/u, ["ja"]],
  [/\p{Script=Han}/u, ["zh", "zh-hant", "ja"]],
];
const languagesForText = (t: string) => SCRIPT_LANGS.filter(([re]) => re.test(t)).flatMap(([, langs]) => langs);

// "running" → running, runn, run; "tacos" → tacos, taco.
function variants(w: string): string[] {
  const v = [w];
  if (w.endsWith("ing") && w.length > 5) v.push(w.slice(0, -3), w.slice(0, -3) + "e");
  if (w.endsWith("es") && w.length > 4) v.push(w.slice(0, -2));
  if (w.endsWith("s") && w.length > 3) v.push(w.slice(0, -1));
  if (w.endsWith("ed") && w.length > 4) v.push(w.slice(0, -2), w.slice(0, -1));
  if (w.startsWith("ال") && w.length > 4) v.push(w.slice(2)); // Arabic "the"
  if (w.startsWith("ה") && w.length > 4) v.push(w.slice(1)); // Hebrew "the"
  return v;
}

const MIN_SCORE = 0.9;

/** The best emoji for what someone typed, or null when nothing in it is specific enough. */
type Credit = (i: number, w: number) => void;

/** Scores one typed word against the loaded languages (exact, inflected-stem and compound matches). */
function creditToken(idx: Index, tok: string, credit: Credit) {
  const rarityOf = (w: string) => 1 / Math.pow(idx.df.get(w) ?? 1, 0.75);
  let found = false;
  for (const v of variants(tok)) {
    const inLabel = idx.label.get(v);
    const inTag = idx.tag.get(v);
    const inMore = idx.tagMore.get(v);
    if (!inLabel && !inTag && !inMore) continue;
    const rarity = rarityOf(v);
    inLabel?.forEach((i) => credit(i, 3 * rarity));
    inTag?.forEach((i) => credit(i, 1 * rarity));
    inMore?.forEach((i) => credit(i, 1 * rarity));
    found = true;
    break; // the first form of this word that exists is the one we mean
  }
  // Inflected languages (Russian, Polish, Finnish, German endings…): the typed form is a different
  // ending of a word we know. Match on a shared stem of at least 5 letters, at reduced weight.
  if (!found && tok.length >= 6 && !SUBSCRIPT_RE.test(tok)) {
    const stem = tok.slice(0, Math.max(5, tok.length - 2));
    let lo = 0, hi = idx.sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (idx.sorted[mid] < stem) lo = mid + 1; else hi = mid; }
    let taken = 0;
    for (let k = lo; k < idx.sorted.length && taken < 6 && idx.sorted[k].startsWith(stem); k++, taken++) {
      const w = idx.sorted[k];
      const rarity = rarityOf(w);
      idx.label.get(w)?.forEach((e) => credit(e, 2.1 * rarity));
      idx.tag.get(w)?.forEach((e) => credit(e, 0.7 * rarity));
      idx.tagMore.get(w)?.forEach((e) => credit(e, 0.7 * rarity));
      found = true;
    }
  }
  // Compounding languages (German "Weinprobe", Dutch "Boekenclub", Swedish, Finnish…) glue words
  // together, so a long unknown word may contain known ones: find them, longest first.
  if (!found && tok.length >= 8 && !SUBSCRIPT_RE.test(tok) && (idx.cLabel.size || idx.cTag.size)) {
    for (let i = 0; i + 4 <= tok.length; i++) {
      for (let len = Math.min(10, tok.length - i); len >= 4; len--) {
        const w = tok.substr(i, len);
        const inLabel = idx.cLabel.get(w);
        const inTag = idx.cTag.get(w);
        if (!inLabel && !inTag) continue;
        const rarity = rarityOf(w);
        inLabel?.forEach((e) => credit(e, 2.4 * rarity));
        inTag?.forEach((e) => credit(e, 0.8 * rarity));
        i += len - 1;
        break;
      }
    }
  }
}

/** CJK / Thai / Hangul: no spaces to split on, so look for known words anywhere in the text, longest
 *  first, and skip past each one we find. `onWord` gets each found word's position and credits. */
function scanSubscriptWords(idx: Index, t: string, onWord: (start: number, end: number, credit: (cr: Credit) => void) => void) {
  if (!SUBSCRIPT_RE.test(t) || !(idx.subLabel.size || idx.subTag.size || idx.subTagMore.size)) return;
  for (let i = 0; i < t.length; i++) {
    for (let len = Math.min(idx.subMaxLen, t.length - i); len >= 2; len--) {
      const w = t.substr(i, len);
      const inLabel = idx.subLabel.get(w);
      const inTag = idx.subTag.get(w);
      const inMore = idx.subTagMore.get(w);
      if (!inLabel && !inTag && !inMore) continue;
      const rarity = 1 / Math.pow(idx.df.get(w) ?? 1, 0.75);
      onWord(i, i + len, (cr) => {
        inLabel?.forEach((e) => cr(e, 3 * rarity));
        inTag?.forEach((e) => cr(e, 1 * rarity));
        inMore?.forEach((e) => cr(e, 1 * rarity));
      });
      i += len - 1;
      break;
    }
  }
}

function pickBest(idx: Index, scores: Map<number, number>): string | null {
  let best = -1;
  let bestScore = 0;
  scores.forEach((sc, i) => {
    // Ties go to the earlier (more common) emoji in Unicode order.
    if (sc > bestScore || (sc === bestScore && i < best)) {
      best = i;
      bestScore = sc;
    }
  });
  return best >= 0 && bestScore >= MIN_SCORE ? idx.emoji[best] : null;
}

/** The best single emoji for what someone typed, or null when nothing in it is specific enough. */
export function findEmojiForText(text: string | null | undefined, opts?: { skipCurated?: boolean }): string | null {
  const t = norm(text ?? "");
  if (!t) return null;

  // Typing in a script that tells us the language: fetch it; the version bump re-runs whoever asked.
  if (NON_LATIN_RE.test(t)) void ensureEmojiLanguages(languagesForText(t));

  if (!opts?.skipCurated) for (const [re, emoji] of CURATED) if (re.test(t)) return emoji;

  const idx = (index ??= build());
  const scores = new Map<number, number>();
  const credit: Credit = (i, w) => scores.set(i, (scores.get(i) ?? 0) + w);
  for (const tok of t.split(" ").filter((w) => w.length >= 3 && !STOP.has(w))) creditToken(idx, tok, credit);
  scanSubscriptWords(idx, t, (_s, _e, cr) => cr(credit));
  return pickBest(idx, scores);
}

export interface EmojiHit {
  emoji: string;
  /** Offsets into the normalized text returned alongside the hits. */
  start: number;
  end: number;
}

const CURATED_GLOBAL: [RegExp, string][] = CURATED.map(([re, emoji]) => [new RegExp(re.source, "g"), emoji]);

/**
 * EVERY activity named in the text, with where in the sentence it was found — "surf, tennis and
 * dinner" has three. Phrases (curated) claim their words first so "ping pong" is one hit, not "ping"
 * and "pong"; each remaining word is then looked up on its own. Returned in the order said.
 */
export function findEmojiHits(text: string | null | undefined): { text: string; hits: EmojiHit[] } {
  const t = norm(text ?? "");
  const hits: EmojiHit[] = [];
  if (!t) return { text: t, hits };
  if (NON_LATIN_RE.test(t)) void ensureEmojiLanguages(languagesForText(t));

  const covered: [number, number][] = [];
  const isCovered = (s: number, e: number) => covered.some(([a, b]) => s < b && e > a);

  for (const [re, emoji] of CURATED_GLOBAL) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      hits.push({ emoji, start: m.index, end: m.index + m[0].length });
      covered.push([m.index, m.index + m[0].length]);
    }
  }

  const idx = (index ??= build());
  const wordRe = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(t))) {
    const tok = m[0];
    const start = m.index;
    const end = start + tok.length;
    if (tok.length < 3 || STOP.has(tok) || isCovered(start, end)) continue;
    const scores = new Map<number, number>();
    creditToken(idx, tok, (i, w) => scores.set(i, (scores.get(i) ?? 0) + w));
    const emoji = pickBest(idx, scores);
    if (emoji) hits.push({ emoji, start, end });
  }
  scanSubscriptWords(idx, t, (start, end, cr) => {
    if (isCovered(start, end)) return;
    const scores = new Map<number, number>();
    cr((i, w) => scores.set(i, (scores.get(i) ?? 0) + w));
    const emoji = pickBest(idx, scores);
    if (emoji) hits.push({ emoji, start, end });
  });

  hits.sort((a, b) => a.start - b.start);
  return { text: t, hits };
}

/** The same normalization the search uses, for callers that need offsets that line up with findEmojiHits. */
export const normalizeEmojiText = norm;
