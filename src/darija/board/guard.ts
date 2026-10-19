/**
 * Validates board-write payloads before they reach the visual board.
 * The large middle zone is an exam-style French / math surface: Darija prose
 * belongs in speech (or in an explicitly spoken right-zone example), never there.
 */
const ARABIC_SCRIPT = /[\u0600-\u06FF]/u;

/** Any backslash command: \\propto, \\text, \\frac… French prose never contains these. */
const LATEX_COMMAND = /\\[A-Za-z]{2,}/;

const MATH_COMMAND =
  /\\(frac|dfrac|sqrt|int|sum|prod|lim|vec|hat|overline|left|right|alpha|beta|gamma|delta|theta|lambda|mu|pi|rho|sigma|omega|Delta|Sigma|Omega|times|cdot|div|leq|geq|neq|approx|infty|partial|rightarrow|to|log|ln|sin|cos|tan)\b/;

export function hasArabicScript(value: unknown): boolean {
  if (typeof value === "string") return ARABIC_SCRIPT.test(value);
  if (Array.isArray(value)) return value.some((item) => hasArabicScript(item));
  return false;
}

/** Detects an equation/formula written as plain text (not normal French prose). */
export function looksLikeEquation(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || ARABIC_SCRIPT.test(text)) return false;

  // If it has inline math delimiters $...$, it is prose with embedded math, not a standalone formula
  if (/\$/.test(text)) return false;

  // Inspect prose words outside \text{...}
  const withoutText = text.replace(/\\text(?:bf|it|rm|sf|tt)?\{[^}]*\}/g, "");
  const proseRegex = /\b(soit|soient|on|et|ou|avec|dans|pour|est|sont|si|donc|comme|qui|que|par|sur|une?|les?|des?|du|ce|cette|ces|son|sa|ses|leur|leurs|notre|votre|cette|droite|gauche|dépend|relation|complexe|nombre|forme)\b/i;
  if (proseRegex.test(withoutText)) return false;

  // A LaTeX control sequence without external prose words:
  if (LATEX_COMMAND.test(text)) return true;
  if (text.length > 120) return false;
  if (MATH_COMMAND.test(text)) return true;

  const words = text.split(/\s+/).filter(Boolean);
  const proseWords = words.filter((word) => /^[A-Za-zÀ-ÿ]{4,}[.,;:!?]?$/.test(word)).length;
  if (proseWords >= 3) return false;

  const hasRelation = /[=<>≤≥≠]/.test(text);
  const hasMathSyntax = /[\^_]|\\|\//.test(text);
  const hasSymbolAndDigit = /[A-Za-z]/.test(text) && /\d/.test(text);
  const hasFunctionCall = /[A-Za-z]\s*\(\s*[A-Za-z0-9]/.test(text);
  const hasShortOperands = /(^|[\s(])[A-Za-z0-9]{1,3}\s*[+*×÷]\s*[A-Za-z0-9]{1,3}([\s)]|$)/.test(text);
  return hasRelation || hasMathSyntax || hasSymbolAndDigit || hasFunctionCall || hasShortOperands;
}

/** True when the string is a Latin word (not math) before a "label :" split. */
function isPlainLabel(label: string): boolean {
  return /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\- ]*$/.test(label) && !/[=<>≤≥≠^_\\\/]/.test(label);
}

/** 3+ letter words that are genuinely math notation, not French prose. */
const MATH_WORDS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "lim", "max", "min",
  "sup", "inf", "det", "exp", "mod", "gcd", "arg", "vec", "hat", "bar", "abs",
]);

/** Symbol-like tokens (PV, nRT, TPN): notation, never French prose. */
function isSymbolWord(word: string): boolean {
  return /^[A-Z]{1,5}$/.test(word) || /^[a-z][A-Za-z]*[A-Z]/.test(word);
}

/**
 * True when a single `$...$` span is really PROSE (French words, units) and
 * must not be typeset by KaTeX. Math mode drops every space, so the model's
 * `Pour $1 mole de gaz à TPN$` used to render as "Pour1moledegazaTPN".
 */
function isProseMathSpan(span: string): boolean {
  const text = span.trim();
  if (!text) return true;
  // A real LaTeX command means real math ("\frac{3}{4}").
  if (/\\[A-Za-z]{2,}/.test(text)) return false;
  // No whitespace at all: a single token is math ("TPN", "3-2i", "0,75").
  if (!/\s/.test(text)) return false;
  // "la forme z = a + ib où i^2 = -1", "1 mole de gaz à TPN", "M = 18 g/mol"
  // → prose. "PV = nRT", "z = a + ib", "x^2 + 3x - 4" contain no French word.
  return text.split(/\s+/).some((token) => {
    const word = token.replace(/[^A-Za-zÀ-ÿ]+/g, "");
    return word.length >= 3 && !isSymbolWord(word) && !MATH_WORDS.has(word.toLowerCase());
  });
}

/** Removes the $...$ delimiters around prose spans, leaving real math intact. */
function stripProseMathDelimiters(value: string): string {
  return value.replace(/\$([^$\n]+)\$/g, (whole, span: string) =>
    isProseMathSpan(span) ? span.trim() : whole,
  );
}

/**
 * Cleans every textual field of a board write before any normalization:
 * KaTeX is only for real math, never for French sentences or units.
 */
export function sanitizeBoardWriteText(args: Record<string, unknown>): Record<string, unknown> {
  const next = { ...args };
  if (typeof next.content === "string") next.content = stripProseMathDelimiters(next.content);
  if (typeof next.title === "string") next.title = stripProseMathDelimiters(next.title);
  if (typeof next.term === "string") next.term = stripProseMathDelimiters(next.term);
  if (Array.isArray(next.items)) {
    next.items = next.items.map((item) =>
      typeof item === "string" ? stripProseMathDelimiters(item) : item,
    );
  }
  return next;
}

/**
 * Makes model-written math explicit for tool feedback; rendering still has its own fallback.
 * "Label : equation" is left as text: the renderer keeps the label handwritten and
 * typesets only the equation, instead of math-fonding the whole line.
 * IMPORTANT: content that has $...$ delimiters is PROSE with inline math (e.g.
 * "Soit $z = a + ib$ et son conjugué $\bar{z} = a - ib$"). It must stay as text so
 * ChalkText can render the prose in French and only the $...$ spans as KaTeX inline.
 * Promoting it to type='formula' would strip the $ signs and pass the entire
 * French sentence to KaTeX display mode, which collapses all spaces and produces
 * "Soitz = a + ibetz̄ = a − ib" as a single unbroken formula.
 */
export function normalizeBoardWriteMath(args: Record<string, unknown>): Record<string, unknown> {
  const type = args.type;
  const zone = args.zone;
  const content = typeof args.content === "string" ? args.content.trim() : "";

  // A prose sentence forced into a formula block would still lose its spaces in
  // math mode; render it as plain text instead of a broken unreadable formula.
  if (
    zone === "middle" &&
    (type === "formula" || type === "latex") &&
    isProseMathSpan(content)
  ) {
    return { ...args, type: "text" };
  }

  if (zone !== "middle" || (type !== "text" && type !== "takeaway")) return args;

  // $...$ delimiters = prose with inline math. ChalkText handles this correctly
  // via its inlineMath pipeline; promoting to formula would destroy the layout.
  if (/\$[^$\n]+\$/.test(content)) return args;

  // A pure LaTeX formula has NO $ signs and NO French prose words around the math.
  if (!looksLikeEquation(content)) return args;

  const split = content.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\- ]{1,30})\s*[:：]\s*([\s\S]+)$/);
  if (split && isPlainLabel(split[1]) && looksLikeEquation(split[2])) return args;

  return { ...args, type: type === "takeaway" ? "takeaway" : "formula" };
}

/**
 * A question posed to the learner becomes a dedicated question block: it is
 * labelled "Question :", never framed, and never wipes existing content.
 * Recognized from an explicit "Question :" prefix or a trailing question mark.
 */
export function normalizeBoardWriteQuestion(args: Record<string, unknown>): Record<string, unknown> {
  if (args.zone !== "middle" || args.items) return args;
  if (args.type !== "text" && args.type !== "question") return args;
  const content = typeof args.content === "string" ? args.content.trim() : "";
  if (!content) return args;

  // The board adds "Question :" itself, so strip any label the model included.
  const labelled = content.match(/^(?:questions?|q\s*\d*)\s*[:：]\s*([\s\S]+)$/i);
  if (args.type === "question") {
    const body = (labelled ? labelled[1].trim() : content).replace(/\s*[:：]\s*$/, "");
    return body ? { ...args, content: body } : args;
  }

  const isQuestion = Boolean(labelled) || /[?؟]\s*$/.test(content);
  if (!isQuestion) return args;

  const body = (labelled ? labelled[1].trim() : content).replace(/\s*[:：]\s*$/, "");
  if (!body) return args;
  return { ...args, type: "question", content: body };
}

/** Longest board question accepted; board questions must stay short and simple. */
export const MAX_QUESTION_CHARS = 180;

/** Labels that are sentence openers, not defined terms — left as plain text. */
const NON_TERM_LABELS = new Set([
  "definition", "définition", "résultat", "resultat", "conclusion", "remarque",
  "formule", "exemple", "rappel", "programme", "plan", "note", "observation",
  "question", "questions", "q", "q1", "q2", "q3",
  "attention", "attentions", "garde", "gardez", "il faut", "il ne faut", "ne pas",
  "à retenir", "astuce", "erreur", "erreur fréquente",
]);

/**
 * "Term : French definition prose" written as plain text becomes a proper
 * definition block, so the term is yellow, boxed and framed instead of a
 * white paragraph with no hierarchy.
 */
export function normalizeBoardWriteDefinition(args: Record<string, unknown>): Record<string, unknown> {
  if (args.zone !== "middle" || args.type !== "text" || args.items) return args;
  const content = typeof args.content === "string" ? args.content.trim() : "";
  const match = content.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\- ]{1,40})\s*[:：]\s*([\s\S]+)$/);
  if (!match) return args;
  const label = match[1].trim().replace(/\s+/g, " ");
  const tail = match[2].trim();
  if (NON_TERM_LABELS.has(label.toLowerCase())) return args;
  if (looksLikeEquation(tail) || ARABIC_SCRIPT.test(tail)) return args;
  // Enumerations ("Programme : 1. ... 2. ...") are roadmaps, not definitions.
  if (/^\s*\d+[.)]\s/.test(tail)) return args;
  const tailWords = tail.split(/\s+/).filter((word) => /^[A-Za-zÀ-ÿ]{3,}/.test(word));
  if (tail.length < 25 || tailWords.length < 4) return args;
  return { ...args, type: "definition", term: label, content: tail };
}
