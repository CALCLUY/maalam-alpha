/**
 * Gate right-zone examples so an example is never drawn merely because its
 * French title was said. The Darija example body itself must be substantially
 * present in maalam's audio transcription first.
 */
const STOP_WORDS = new Set([
  "مثلا", "مثال", "بحال", "ديال", "على", "هاد", "هادا", "هادي", "اللي", "فاش", "كيكون", "كتكون",
  "كاين", "واحد", "واحدة", "من", "في", "مع", "و", "ولا", "هي", "هو", "هذا", "هذه",
  "the", "a", "an", "of", "to", "is", "are", "and", "in", "on", "for", "with", "de", "du", "la", "le", "les", "un", "une", "des",
]);

function normalizeWords(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function isExampleWrite(args: Record<string, unknown>): boolean {
  return args.zone === "right" || args.type === "example";
}

/** Clear teacher-to-student chatter. Deliberately narrow so real examples are never rejected. */
const SPEECH_NOT_EXAMPLE =
  /(واش فهمتي|شنو رايك|جاوبني|عاود ليا|مرحبا بيك|سلام عليكم|يالاه نبداو|سؤال ليك|جرب دابا|قول ليا شنو)/u;

const EXAMPLE_TYPES = new Set(["example", "text", "list"]);

/**
 * The right zone is examples only. Reject anything that is really just speech,
 * but stay permissive about the exact shape of a genuine example so real
 * examples are never dropped: zone="right" with text/list is rendered as an
 * example, and a missing title simply falls back to "Exemple :".
 */
export function isValidExampleArgs(args: Record<string, unknown>): { ok: true } | { ok: false; reason: string } {
  const isRightZone = args.zone === "right";
  const type = typeof args.type === "string" ? args.type : "";

  if (!isRightZone && type !== "example") {
    return { ok: false, reason: "Only examples belong in zone='right'. Put explanations, steps and formulas in zone='middle'." };
  }
  if (isRightZone && type && !EXAMPLE_TYPES.has(type)) {
    return {
      ok: false,
      reason: "The right zone holds darija examples only. Use type='example' (text/list also work); headings, formulas and diagrams go in zone='middle'.",
    };
  }

  const items = Array.isArray(args.items) ? args.items.map((item) => String(item)).join(" ") : "";
  const content = typeof args.content === "string" ? args.content.trim() : "";
  const body = content || items.trim();

  if (body.length < 12) {
    return { ok: false, reason: "The example body is too short to be a worked example. Give a concrete darija situation." };
  }
  if (!/[\u0600-\u06FF]/.test(body)) {
    return { ok: false, reason: "The example body must be written in Moroccan darija (Arabic script)." };
  }
  if (/[?؟]\s*$/.test(body) || SPEECH_NOT_EXAMPLE.test(body)) {
    return { ok: false, reason: "That is conversation, not an example. Do not write your speech in the example zone." };
  }
  return { ok: true };
}

/** Spoken cues that an example is actually being told out loud. */
const SPOKEN_EXAMPLE_CUE =
  /(مثلا|مثال|بحال|تخيّل|تخيل|نفترضو|خود مثال|شوف مثلا|par exemple|exemple|imagine|suppose)/iu;

export function exampleMentionedInSpeech(args: Record<string, unknown>, transcript: string): boolean {
  if (!transcript.trim()) return false;
  const items = Array.isArray(args.items) ? args.items.map((item) => String(item)).join(" ") : "";
  const content = (typeof args.content === "string" ? args.content.trim() : "") || items.trim();
  if (content.length < 8) return false;

  const spokenWords = normalizeWords(transcript);
  const bodyWords = normalizeWords(content).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  const uniqueBodyWords = Array.from(new Set(bodyWords));
  if (!uniqueBodyWords.length) return false;

  const spokenSet = new Set(spokenWords);
  const matched = uniqueBodyWords.filter((word) => spokenSet.has(word)).length;
  const ratio = uniqueBodyWords.length ? matched / uniqueBodyWords.length : 0;

  // The board writes a condensed version of what was said, and Darija speech-to-text
  // varies in spelling, so accept real speech evidence rather than a verbatim match.

  // Signal 1: the spoken words substantially overlap the example body.
  if (matched >= 3 && ratio >= 0.4) return true;

  // Signal 2: the teacher said an example cue AND named the concept or its content.
  if (SPOKEN_EXAMPLE_CUE.test(transcript)) {
    const title = typeof args.title === "string" ? args.title.trim() : "";
    const titleWords = normalizeWords(title).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
    if (titleWords.some((word) => spokenSet.has(word))) return true;
    if (matched >= 2) return true;
    const spokenLower = transcript.toLocaleLowerCase();
    const frenchTerms = (content.match(/[A-Za-zÀ-ÿ]{4,}/g) ?? []).map((word) => word.toLocaleLowerCase());
    if (frenchTerms.some((word) => spokenLower.includes(word))) return true;
  }

  return false;
}

/** Board words that appear in almost every line: they must never count as
 *  evidence that THIS block is the one being spoken right now. */
const GENERIC_BOARD_WORDS = new Set([
  "definition", "exemple", "formule", "equation", "question", "reponse", "exercice",
  "propriete", "remarque", "demonstration", "calcul", "theoreme", "methode", "etape",
  "regle", "resultat", "attention", "point", "clé", "cle", "titre", "partie",
]);

function cleanBoardText(text: string): string {
  return text
    .replace(/\\[a-zA-Z]+\{?/g, " ")
    .replace(/[{}$\\_^~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Speech-synced writing: true when the transcript shows the tutor is saying the
 * substance of THIS block right now. Used so every board line is written while
 * the voice is on it — never ahead of the tutor and never long after.
 */
export function blockMentionedInSpeech(
  block: { content?: string; title?: string; term?: string; items?: string[] },
  transcript: string,
): boolean {
  if (!transcript.trim()) return false;
  const body = cleanBoardText(
    [block.title ?? "", block.term ?? "", block.content ?? "", ...(block.items ?? [])].join(" "),
  );
  if (!body.trim()) return false;

  // Accent-insensitive comparison on both sides: the transcript often drops
  // accents ("energie" for "énergie") and French stop/generic words only filter
  // correctly once combining marks are gone.
  const normalize = (text: string) =>
    text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const spokenNorm = normalize(transcript);
  const spokenSet = new Set(normalizeWords(transcript));
  const spokenWords = Array.from(spokenSet);
  const words = normalizeWords(body).filter(
    (word) => word.length > 2 && !STOP_WORDS.has(word) && !GENERIC_BOARD_WORDS.has(word),
  );
  const unique = Array.from(new Set(words));
  if (!unique.length) {
    // Math-only lines carry no words: a distinctive French term is the only
    // signal, and there is none — let the paced fallback write it.
    return false;
  }

  // Arabic clitics attach to words ("بالمقدمة" carries "المقدمة"), so a match
  // counts when the spoken word carries the board word or vice versa (a short
  // prefix/suffix, not arbitrary substrings).
  const said = (word: string): boolean => {
    if (spokenSet.has(word)) return true;
    if (word.length < 4) return false;
    return spokenWords.some(
      (spoken) =>
        (spoken.length <= word.length + 3 && spoken.endsWith(word)) ||
        (word.length <= spoken.length + 3 && word.startsWith(spoken)),
    );
  };

  const matched = unique.filter(said).length;
  const ratio = matched / unique.length;

  // A one- or two-word line (a heading, a label, a short takeaway) is matched by
  // its own word being said.
  if (unique.length <= 2 && matched >= 1) return true;
  // The voice repeats short lines (headings, questions, takeaways) almost verbatim.
  if (matched >= 2 && ratio >= 0.5) return true;
  if (matched >= 3 && ratio >= 0.35) return true;

  // A distinctive French technical term is enough on its own: when the tutor says
  // "énergie cinétique", the line carrying it is the one being explained. Generic
  // board words ("Définition", "Exemple", "Formule") are excluded so they cannot
  // pull a block early.
  const terms = (normalize(body).match(/[a-z]{5,}/g) ?? []);
  if (terms.some((word) => !GENERIC_BOARD_WORDS.has(word) && spokenNorm.includes(word))) return true;

  return false;
}
