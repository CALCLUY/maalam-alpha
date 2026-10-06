/**
 * Fixes missing spaces in board text. The model often returns several sentences
 * glued together ("Donc on déduit.Alors la partie réelle") or a sentence jammed
 * against a formula ("soitz = a + ib"), which renders as one unreadable run of
 * chalk. Only text OUTSIDE $...$ is touched, so LaTeX is never damaged.
 */

const MATH_SPLIT = /(\$[^$\n]*\$)/g;

/** One normalisation pass over a run of prose (no $...$ inside). */
function fixProse(text: string): string {
  let out = text;
  // A sentence end jammed against the next word: "déduit.Alors" -> "déduit. Alors"
  out = out.replace(/([.,;:!?؟،])(?=[^\s\d.,;:!?؟،)$])/g, "$1 ");
  // A letter/digit glued to an opening bracket after a word: "réelle(z = …)"
  out = out.replace(/([\p{L}\p{N}])([([])(?=[\p{L}\p{N}])/gu, "$1 $2");
  // A closing bracket glued to a following word: "(z = a + ib)est" -> ") est"
  out = out.replace(/([)\]])(?=[\p{L}\p{N}])/gu, "$1 ");
  // Collapse the whitespace this may have created.
  out = out.replace(/[ \t]{2,}/g, " ");
  return out;
}

/**
 * Normalises spacing in board content while leaving every $...$ formula exactly
 * as the model wrote it.
 */
export function fixSentenceSpacing(text: string): string {
  if (!text || !text.includes(".") && !text.includes("!") && !text.includes("?") && !text.includes("؟") && !text.includes(":") && !text.includes(",") && !text.includes("(")) {
    return text;
  }
  return text
    .split(MATH_SPLIT)
    .map((part) => (part.startsWith("$") && part.endsWith("$") && part.length > 1 ? part : fixProse(part)))
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
