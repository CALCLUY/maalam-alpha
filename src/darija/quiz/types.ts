/**
 * Interactive check questions the tutor asks instead of making the learner type.
 * The learner taps, orders or fills a small blank — only "free" needs real typing,
 * and "blank" gets a math pad so nobody has to type "3/4 / 2/5 = ..." by hand.
 */

export type QuizKind =
  | "mcq" // one correct answer out of 3-4 tricky traps
  | "multi" // select all that apply
  | "order" // arrange steps in the correct order
  | "truefalse"
  | "compare"; // two students' solutions: which one is correct?

export type QuizItem = {
  id: string;
  kind: QuizKind;
  /** Short, simple French question — same voice as the board questions. */
  prompt: string;
  /** Optional one-line instruction ("Select all...", "In order..."). */
  instruction?: string;
  /** Choices for mcq / multi / compare (compare = exactly 2 solutions). */
  options?: string[];
  /** Steps to arrange, for "order" (displayed shuffled). */
  items?: string[];
  /** Fill-in-one-blank gets the math pad instead of a bare text field. */
  math?: boolean;
};

export const QUIZ_KIND_LABEL: Record<QuizKind, string> = {
  mcq: "اختار الجواب",
  multi: "اختار كلشي اللي صحيح",
  order: "رتّب الخطوات",
  truefalse: "صواب ولا خطأ",
  compare: "أي حل صحيح؟",
};

/** Deterministic display shuffle so the steps do not jump between renders. */
export function shuffled(items: string[]): string[] {
  const decorated = items.map((text) => ({
    text,
    key: [...text].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7),
  }));
  return decorated
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.text);
}

/**
 * Turns the learner's interaction into one plain learner message, so the tutor
 * reads it exactly like a spoken answer and can give feedback on it.
 */
export function formatQuizAnswer(item: QuizItem, value: string | string[]): string {
  const values = Array.isArray(value) ? value : [value];
  switch (item.kind) {
    case "mcq":
    case "compare":
      return `الجواب: ${values[0]}`;
    case "multi":
      return `الجواب (كلشي اللي اختاريت): ${values.join("، ")}`;
    case "order":
      return `الترتيب من الأول للآخر: ${values
        .map((step, index) => `${index + 1}) ${step}`)
        .join(" · ")}`;
    case "truefalse":
      return `الجواب: ${values[0] === "true" ? "صحيح" : "خطأ"}`;
    default:
      return values[0];
  }
}
