import type { Article } from "@/lib/types";

// KFL hides sport and advertising news. WordPress files almost everything under "Lajme",
// so detection is by keywords in the title (and, for sport, a strong signal in the excerpt).
// To hide/show more stories, edit the lists below.

const SPORT_WORDS = [
  "sport", "sporti", "sportiv", "sportive", "futboll", "futbolli", "futbollist", "futbollisti", "football",
  "superliga", "superligen", "superliges", "uefa", "fifa", "kombetarja", "kombetares", "ndeshje", "ndeshja", "ndeshjen",
  "kampionat", "kampionati", "kampionatin", "kampion", "kampione", "gol", "gola", "golin", "golat", "trajner", "trajneri",
  "skuadra", "skuadres", "transferim", "transferimi", "basketboll", "basketbolli", "nba", "volejboll", "hendboll",
  "tenis", "tenisti", "boks", "boksier", "boksieri", "motogp", "olimpik", "olimpike", "olimpiade", "atletike", "xhudo", "xhudos", "xhudistja", "medalje", "medaljen", "medalja",
  "xhudiste", "mundje", "psg", "barcelona", "barca", "liverpool", "chelsea", "arsenal", "juventus", "bayern", "milan",
  "napoli", "lazio", "interi", "reali", "derbi", "derbit", "stadium", "stadiumi", "mesfushor", "sulmues", "sulmuesi", "madrilen", "madrilene", "madridit", "barcelones", "laliga", "trajnerit", "skuadra", "golashenues", "ufc", "mma", "nokaut", "nokauton", "bantamweight", "lightweight", "heavyweight", "featherweight", "sepang", "grand prix", "motocross", "clasico", "clasicon", "clasicos", "tifoze", "tifozet", "tifozeve", "bashkelojtar", "klub", "klubi",
  "portier", "portieri", "penallti", "penalltia", "ekipi", "kupa", "kupen", "turne", "turneu",
];
const SPORT_PHRASES = [
  "liga e kampioneve", "champions league", "europa league", "conference league", "ekipi kombetar",
  "formula 1", "formula one", "real madrid", "manchester city", "manchester united", "inter milan", "ac milan",
  "paris saint germain", "kupa e botes", "botrori i futbollit", "euro 2028", "serie a", "la liga", "premier league", "el clasico", "formacionet zyrtare", "gara per titull", "garen per titull", "titullin kampion",
];
// Words that can appear in sport but are too common elsewhere count only together with another sport word.
const WEAK_SPORT = new Set(["barcelona", "barcelones", "tifoze", "tifozet", "tifozeve", "klub", "klubi", "sulmues", "sulmuesi", "ekipi", "kupa", "kupen", "turne", "turneu", "kampion", "kampione", "milan", "reali", "stadium", "stadiumi", "gol", "gola", "medalje", "medaljen", "medalja"]);

const AD_WORDS = [
  "reklame", "reklama", "reklamim", "sponsorizuar", "sponzorizuar", "sponsoruar", "sponzoruar",
  "advertorial", "promocion", "promocioni", "promo",
];
const AD_PHRASES = ["permbajtje e sponsorizuar", "artikull i sponsorizuar", "artikull sponsorizues", "ne bashkepunim me", "paid partnership", "bli tani", "porosit tani"];
const AD_TITLE_PREFIX = /^\s*[[(]?\s*(pr|reklam[aë]?|sponsor\w*|sponzor\w*|promo\w*|advertorial)\s*[\])]?\s*[:|–—-]/i;

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function score(text: string, words: string[], phrases: string[], weak = new Set<string>()) {
  const tokens = normalize(text).split(" ").filter(Boolean);
  const padded = ` ${tokens.join(" ")} `;
  const strong = new Set<string>();
  const weakHits = new Set<string>();
  for (const token of tokens) {
    // Exact word, or a long word with an Albanian ending ("futbollistët", "kampionatit").
    const word = words.find((item) => token === item || (item.length >= 6 && token.startsWith(item)));
    if (word) (weak.has(word) ? weakHits : strong).add(word);
  }
  // Phrases may also carry an ending on the last word ("Real Madridit").
  for (const phrase of phrases) if (padded.includes(` ${phrase}`)) strong.add(phrase);
  return { strong: strong.size, weak: weakHits.size };
}

export function isKflSportArticle(article: Article) {
  if (article.category === "Sport") return true;
  const title = score(`${article.title} ${(article.terms ?? []).join(" ")}`, SPORT_WORDS, SPORT_PHRASES, WEAK_SPORT);
  if (title.strong >= 1 || title.weak >= 2) return true;
  // The excerpt alone needs several sport signals, so a crime/news story that mentions a match isn't hidden.
  const excerpt = score(article.excerpt ?? "", SPORT_WORDS, SPORT_PHRASES, WEAK_SPORT);
  return excerpt.strong >= 3 || (excerpt.strong >= 2 && title.weak >= 1);
}

export function isKflAdArticle(article: Article) {
  if (AD_TITLE_PREFIX.test(article.title)) return true;
  const title = score(article.title, AD_WORDS, AD_PHRASES);
  if (title.strong >= 1) return true;
  return score(article.excerpt ?? "", ["sponsorizuar", "sponzorizuar", "advertorial"], AD_PHRASES).strong >= 1;
}

export function kflHiddenReason(article: Article): "sport" | "reklama" | null {
  if (isKflAdArticle(article)) return "reklama";
  if (isKflSportArticle(article)) return "sport";
  return null;
}
