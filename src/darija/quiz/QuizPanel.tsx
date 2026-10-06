import { useState } from "react";
import { ChalkMix } from "./ChalkMix";
import { formatQuizAnswer, QUIZ_KIND_LABEL, shuffled, type QuizItem } from "./types";

/**
 * The learner's answer surface: tap choices, order steps, fill one blank (with
 * the math pad) or write a short free response. Submitting turns the whole
 * interaction into ONE learner message so the tutor can react to it.
 */
export function QuizPanel({
  item,
  onSubmit,
  onSkip,
  disabled = false,
}: {
  item: QuizItem;
  onSubmit: (answerText: string) => void;
  onSkip: () => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  // Shuffled once per question (the panel is remounted per question id), so the
  // steps never jump around while the learner is arranging them.
  const [steps, setSteps] = useState<string[]>(() =>
    item.kind === "order" ? shuffled(item.items ?? []) : [],
  );

  const needsChoices = item.kind === "mcq" || item.kind === "multi" || item.kind === "compare";
  const hasChoices = (item.options?.length ?? 0) >= (item.kind === "compare" ? 2 : 2);
  const hasPrompt = Boolean(item.prompt?.trim());
  const hasOrder = item.kind !== "order" || steps.length >= 2;
  // Incomplete questions (no prompt, no choices) never reach the learner —
  // the tutor is told to resend a complete one instead.
  if (!hasPrompt || (needsChoices && !hasChoices) || !hasOrder) return null;

  const send = (value: string | string[]) => {
    const text = formatQuizAnswer(item, value);
    if (!text.trim()) return;
    onSubmit(text);
  };

  /** Single-choice kinds answer in ONE tap — no typing, no confirm step. */
  const tapAnswer = (option: string) => {
    if (disabled) return;
    send(option);
  };

  const toggleChoice = (option: string) => {
    if (disabled) return;
    setSelected((current) =>
      current.includes(option)
        ? current.filter((entry) => entry !== option)
        : [...current, option],
    );
  };

  const moveStep = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  return (
    <section className="quiz-panel" aria-label="سؤال تفاعلي">
      <header className="quiz-head">
        <span className="quiz-kind">{QUIZ_KIND_LABEL[item.kind]}</span>
        {item.prompt ? (
          <p className="quiz-prompt" dir="auto">
            <ChalkMix text={item.prompt} />
          </p>
        ) : null}
        {item.instruction ? (
          <p className="quiz-instruction" dir="auto">
            <ChalkMix text={item.instruction} />
          </p>
        ) : null}
      </header>

      <div className="quiz-body">
        {(item.kind === "mcq" || item.kind === "compare") && (item.options?.length ?? 0) >= 2 && (() => {
          const isShort =
            (item.options ?? []).length === 4 &&
            (item.options ?? []).every((opt) => opt.replace(/\$[^$]+\$/g, "xxxx").length <= 26);
          const gridClass = item.kind === "compare" ? " is-compare" : isShort ? " is-grid-2" : "";
          return (
            <div className={`quiz-choices${gridClass}`} dir="auto">
              {(item.options ?? []).map((option, index) => (
                <button
                  key={`${index}-${option}`}
                  type="button"
                  className="quiz-choice"
                  disabled={disabled}
                  onClick={() => tapAnswer(option)}
                >
                  {item.kind === "compare" ? (
                    <span className="quiz-choice-tag">{index === 0 ? "التلميذ أ" : "التلميذ ب"}</span>
                  ) : (
                    <span className="quiz-choice-badge" aria-hidden="true">
                      {String.fromCharCode(65 + index)}
                    </span>
                  )}
                  <span className="quiz-choice-text">
                    <ChalkMix text={option} />
                  </span>
                </button>
              ))}
            </div>
          );
        })()}

        {item.kind === "truefalse" && (
          <div className="quiz-truefalse">
            <button type="button" className="quiz-choice is-true" disabled={disabled} onClick={() => send("true")}>
              صحيح ✓
            </button>
            <button type="button" className="quiz-choice is-false" disabled={disabled} onClick={() => send("false")}>
              خطأ ✗
            </button>
          </div>
        )}

        {item.kind === "multi" && (item.options?.length ?? 0) >= 2 && (() => {
          const isShort =
            (item.options ?? []).length === 4 &&
            (item.options ?? []).every((opt) => opt.replace(/\$[^$]+\$/g, "xxxx").length <= 26);
          return (
            <div className={`quiz-choices${isShort ? " is-grid-2" : ""}`} dir="auto">
              {(item.options ?? []).map((option, index) => {
                const picked = selected.includes(option);
                return (
                  <button
                    key={`${index}-${option}`}
                    type="button"
                    className={`quiz-choice${picked ? " is-selected" : ""}`}
                    aria-pressed={picked}
                    disabled={disabled}
                    onClick={() => toggleChoice(option)}
                  >
                    <span className="quiz-check" aria-hidden="true">
                      {picked ? "✓" : ""}
                    </span>
                    <span className="quiz-choice-text">
                      <ChalkMix text={option} />
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {item.kind === "order" && (
          <ol className="quiz-order" dir="auto">
            {steps.map((step, index) => (
              <li key={step} className="quiz-order-row">
                <span className="quiz-order-index">{index + 1}</span>
                <span className="quiz-order-text">
                  <ChalkMix text={step} />
                </span>
                <span className="quiz-order-controls">
                  <button
                    type="button"
                    className="math-key"
                    aria-label="حرّك لفوق"
                    disabled={disabled || index === 0}
                    onClick={() => moveStep(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="math-key"
                    aria-label="حرّك لتحت"
                    disabled={disabled || index === steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}

      </div>

      <footer className="quiz-foot">
        <button type="button" className="quiz-skip" onClick={onSkip} disabled={disabled}>
          تجاوز
        </button>
        {item.kind === "multi" || item.kind === "order" ? (
          <button
            type="button"
            className="quiz-submit"
            disabled={disabled || (item.kind === "multi" ? selected.length === 0 : steps.length === 0)}
            onClick={() => send(item.kind === "multi" ? selected : steps)}
          >
            صيفط الجواب
          </button>
        ) : (
          <span className="quiz-hint">كليكي على الجواب باش تصيفطو</span>
        )}
      </footer>
    </section>
  );
}
