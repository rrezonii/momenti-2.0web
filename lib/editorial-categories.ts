import { getWordPressArticles } from "@/lib/api";
import type { Article } from "@/lib/types";

type EditorialSection = "Politikë" | "Magazinë" | "Sport" | "Bota" | "Teknologji" | "Shëndeti";

const politicsSignals = [
  "qeveri", "kuvend", "parlament", "deputet", "politik", "zgjedh",
  "president", "presidenc", "kryeminist", "minister", "ministr",
  "opozit", "koalicion", "parti politike", "partia", "votim",
  "trump", "putin", "zelensky", "biden", "nato", "edi rama",
  "bashkimi europian", "komisioni europian", "parlamenti europian",
  "kongres", "senat", "white house", "shtepia e bardhe",
  "kurti", "osmani", "thaci", "begaj", "rrahmani", "pdk", "ldk",
  "vetevendosje", "ministria e financave", "ministria",
];

const magazineSignals = [
  "showbiz", "show business", "show-biz",
  "kengetar", "kengetare", "kenge", "muzik", "aktor", "aktore",
  "film", "serial", "hollywood", "reality show", "big brother",
  "artiste", "artist", "koncert", "reper", "influencer", "celebr",
  "moderator", "moderatore", "emision televiziv", "festival muzikor",
  "vip", "instagramer", "tiktok", "ylli i muzikes",
];

const sportSignals = [
  "sport", "sportiv", "futboll", "football", "superliga", "liga e kampioneve",
  "champions league", "europa league", "conference league", "uefa", "fifa",
  "kombetarja", "ekipi kombetar", "ndeshje", "kampionat", "kampionati",
  "gol", "gola", "trajner", "skuader", "futbollist", "transferim",
  "basketboll", "nba", "volejboll", "hendboll", "tenis", "boks",
  "formula 1", "formula one", "motogp", "olimpik", "atletike",
  "real madrid", "barcelona", "liverpool", "chelsea", "arsenal",
  "manchester city", "manchester united", "bayern munich", "juventus",
  "paris saint germain", "psg", "ac milan", "inter milan",
  "milani fiton", "milani mposht", "milani humb", "milani barazon",
  "kosova luan", "prishtina luan",
];

const technologySignals = [
  "teknologji", "teknologjik", "inteligjencë artificiale", "artificial intelligence",
  "chatgpt", "openai", "gemini ai", "claude ai", "robotikë", "robotik",
  "cybersecurity", "siguri kibernetike", "kibernetik", "haker", "hacking",
  "malware", "ransomware", "smartphone", "telefon i mençur", "android",
  "iphone", "ios", "aplikacion", "softuer", "software", "kompjuter",
  "laptop", "nvidia", "procesor", "çip", "startup", "inovacion teknologjik",
  "digjitalizim", "platformë digjitale", "5g", "6g", "qendër të dhënash",
  "cloud computing", "blockchain", "playstation", "xbox", "video-lojë",
  "google", "apple", "samsung", "microsoft", "meta platforms",
];

const technologyContextSignals = technologySignals.filter(
  (signal) => signal !== "teknologji" && signal !== "teknologjik"
);

const healthSignals = [
  "shëndet", "shëndetësor", "shëndetësi", "shëndeti mendor", "mjek", "mjekësi",
  "mjekësor", "spital", "klinikë", "pacient", "sëmundje", "terapi", "diagnozë",
  "vaksinë", "kancer", "tumor", "diabet",
  "zemër", "kolesterol", "tension i lartë", "grip", "alzheimer", "depresion",
  "ankth", "psikolog", "psikiatri", "farmaci", "ilaç", "ushqyerje",
  "ushqim i shëndetshëm", "dietë", "obezitet", "stërvitje", "ushtrime fizike",
  "healthcare", "medical", "medicine", "doctor", "hospital", "patient",
  "cancer", "vaccine", "nutrition", "mental health", "koronavirus", "hiv",
  "hepatit", "infeksion", "bakter", "infermier", "kirurg", "ambulancë",
  "maternitet", "farmaceutik", "trauma", "traumatologji", "gjumë",
  "ritmi biologjik", "imunitet", "simptom", "astmë", "vaksinim",
];

const healthTopicSignals = [
  "shëndet", "mjekësi", "sëmundje", "terapi", "diagnozë", "vaksinë",
  "kancer", "tumor", "diabet", "zemër", "kolesterol", "tension i lartë",
  "grip", "alzheimer", "depresion", "ankth", "psikolog", "psikiatri",
  "ushqyerje", "dietë", "obezitet", "nutrition", "mental health", "hiv",
  "hepatit", "infeksion", "astmë", "trauma", "traumatologji", "gjumë",
  "ritmi biologjik", "imunitet", "simptom", "vaksinim", "kirurgji",
];

// Vendet, kryeqytetet dhe emërtimet e zakonshme për lajme ndërkombëtare.
// Sinjalet gjeografike përdoren pa filtër teme: politikë, sport, kulturë,
// kronikë dhe çdo lajm tjetër nga këto vende mund të shfaqet te Bota.
const worldSignals = [
  // Rajoni dhe Ballkani
  "ballkan", "ballkanik", "shqiperi", "shqiptar", "tirane", "durres",
  "serbi", "serb", "beograd", "belgrade", "maqedoni", "maqedon",
  "shkup", "skopje", "mali i zi", "mal i zi", "crna gora", "podgorice",
  "malazez", "bosnje", "bosnia", "hercegovine", "sarajeve", "boshnjak",
  "kroaci", "kroat", "zagreb", "slloveni", "ljubljane", "greqi", "grek",
  "athine", "bullgari", "bullgar", "sofia", "rumani", "rumun", "bukuresht",
  "hungari", "hungarez", "budapest", "rajonin e ballkanit", "vendet e rajonit",
  // Evropa dhe vende të tjera
  "shba", "shtetet e bashkuara", "amerike", "amerikan", "kanada", "kanadez",
  "gjermani", "gjerman", "berlin", "france", "francez", "paris", "angli",
  "anglez", "britani", "britanik", "londer", "london", "mbreteria e bashkuar",
  "spanje", "spanjoll", "madrid", "portugali", "portugez", "lisbone", "itali",
  "italian", "rome", "holande", "holandez", "amsterdam", "belgjike", "belgjik",
  "bruksel", "zvicer", "zviceran", "austri", "vjene", "poloni", "polak",
  "varshe", "ukraine", "ukrainas", "kiev", "kiiv", "rusi", "rus", "moske",
  "irlande", "dublin", "suedi", "sued", "norvegji", "norvegjez", "danimarke",
  "finlande", "çek", "prage", "sllovaki", "slloveni", "eston", "letoni", "lituani",
  // Lindja e Mesme, Azia, Afrika, Amerika Latine dhe Oqeania
  "izrael", "izraelit", "tel aviv", "jerusalem", "palestine", "palestinez", "gaza",
  "iran", "iranian", "teheran", "irak", "irakian", "liban", "libanez", "siri",
  "sirian", "arabia saudite", "saudi", "doha", "qatar", "emiratet e bashkuara",
  "kina", "kinez", "pekin", "beijing", "japoni", "japonez", "tokio", "indi",
  "indian", "pakistan", "afganistan", "afgan", "koreja e jugut", "seul", "taiwan",
  "egjipt", "egjiptian", "kajro", "marok", "maroken", "tunizi", "turqi", "turk",
  "ankara", "istanbul", "australi", "australian", "zelanda e re", "brazil", "brazilian",
  "meksike", "meksikan", "argjentine", "argjentinas", "kolumbi", "peru", "kili",
  "evrope", "europian", "bashkimi europian",
];

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sq-AL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchingSignals(source: string, signals: string[]) {
  const text = normalize(source);
  const tokens = new Set(text.split(" "));
  return signals.filter((signal) => {
    const normalizedSignal = normalize(signal);
    return normalizedSignal.includes(" ")
      ? text.includes(normalizedSignal)
      : [...tokens].some((token) =>
          token === normalizedSignal ||
          (normalizedSignal.length >= 5 && token.startsWith(normalizedSignal))
        );
  });
}

function matchesSection(article: Article, section: EditorialSection) {
  const text = normalize(`${article.title} ${article.excerpt ?? ""}`);
  const hasSignal = (signals: string[]) => matchingSignals(text, signals).length > 0;

  if (section === "Bota") return hasSignal(worldSignals);
  if (section === "Teknologji") {
    const titleAndTerms = `${article.title} ${(article.terms ?? []).join(" ")}`;
    if (matchingSignals(titleAndTerms, technologySignals).length > 0) return true;

    // Për përshkrimet kërkojmë sinjale specifike, që një përmendje e vetme
    // e fjalës "teknologji" në një lajm tjetër të mos e kategorizojë gabimisht.
    return matchingSignals(article.excerpt ?? "", technologyContextSignals).length > 0;
  }
  if (section === "Shëndeti") {
    const titleAndTerms = `${article.title} ${(article.terms ?? []).join(" ")}`;
    if (matchingSignals(titleAndTerms, healthSignals).length > 0) return true;

    // Shmang lajmet që e përmendin shëndetin rastësisht vetëm një herë në përmbledhje.
    // Përmbledhja duhet të ketë dy tregues tematikë të ndryshëm, jo vetëm kujdes
    // mjekësor si pasojë e një lajmi për krim, protestë apo aksident.
    const normalizedExcerpt = normalize(article.excerpt ?? "");
    const excerptTokens = normalizedExcerpt.split(" ").filter(Boolean);
    const healthTokenHits = new Set(
      excerptTokens.filter((token) => healthTopicSignals.some((signal) => {
        const normalizedSignal = normalize(signal);
        return !normalizedSignal.includes(" ") && (
          token === normalizedSignal ||
          (normalizedSignal.length >= 5 && token.startsWith(normalizedSignal))
        );
      }))
    );
    const healthPhraseHits = healthTopicSignals.filter((signal) => {
      const normalizedSignal = normalize(signal);
      return normalizedSignal.includes(" ") && normalizedExcerpt.includes(normalizedSignal);
    });
    return healthTokenHits.size + (healthPhraseHits.length > 0 ? 1 : 0) >= 2;
  }

  const hasPoliticsSignal = politicsSignals.some((signal) => text.includes(normalize(signal)));
  const hasMagazineSignal = magazineSignals.some((signal) => text.includes(normalize(signal)));

  if (section === "Politikë") return hasPoliticsSignal;
  if (section === "Magazinë") return !hasPoliticsSignal && hasMagazineSignal;

  return (
    !hasPoliticsSignal &&
    !hasMagazineSignal &&
    sportSignals.some((signal) => text.includes(normalize(signal)))
  );
}

export function getEditorialTopicSlugs(article: Article): string[] {
  const topics: Array<[EditorialSection, string]> = [
    ["Politikë", "politics"],
    ["Bota", "world"],
    ["Sport", "sport"],
    ["Teknologji", "technology"],
    ["Shëndeti", "health"],
    ["Magazinë", "magazine"],
  ];
  const categoryTopic: Partial<Record<Article["category"], string>> = {
    "Politikë": "politics",
    Bota: "world",
    Sport: "sport",
    "Magazinë": "magazine",
  };
  const matched = topics
    .filter(([section]) => matchesSection(article, section))
    .map(([, slug]) => slug);
  const explicit = categoryTopic[article.category];
  if (explicit) matched.push(explicit);
  return [...new Set(matched)];
}

/**
 * Artikujt e importuar si "Lajme" shfaqen edhe në rubrikën editoriale
 * përkatëse kur titulli ose përmbledhja përmban sinjale tematike/gjeografike.
 */
export async function getEditorialSectionArticles(
  section: EditorialSection,
  limit = 100,
  expandArchive = false
): Promise<Article[]> {
  const requestedLimit = Math.max(0, limit);
  // Editorial categories can also include relevant stories imported under
  // "Lajme". Scan a wider range for older pages, while keeping the homepage's
  // default request at its existing 100-item window.
  const archiveMultiplier = 5;
  const sourceLimit = expandArchive
    ? Math.max(section === "Shëndeti" || section === "Teknologji" ? 300 : 100, requestedLimit * archiveMultiplier)
    : Math.min(100, Math.max(30, requestedLimit * 5));
  const [explicitArticles, generalNews] = await Promise.all([
    section === "Teknologji" || section === "Shëndeti"
      ? Promise.resolve([])
      : getWordPressArticles(section, Math.max(1, requestedLimit)),
    // Shëndeti dhe Teknologjia skanojnë postimet nga të gjitha kategoritë;
    // lajmet tematike shpesh importohen me kategori tjetër nga "Lajme".
    getWordPressArticles(
      section === "Shëndeti" || section === "Teknologji" ? undefined : "Lajme",
      sourceLimit
    ),
  ]);

  const combined = new Map<number, Article>();
  const matchingGeneralNews = generalNews
    .filter((item) => matchesSection(item, section))
    .map((article) => section === "Bota" ? { ...article, category: "Bota" as const } : article);

  for (const article of [...explicitArticles, ...matchingGeneralNews]) {
    combined.set(article.id, article);
  }

  return [...combined.values()]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, requestedLimit);
}
