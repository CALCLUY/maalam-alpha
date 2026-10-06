import { useRef, useState } from "react";

/**
 * A compact math answer pad: quick-insert keys for the symbols learners need in
 * maths (operators, powers, root, pi), plus a stacked FRACTION composer so an
 * answer like "3/4 / 2/5" never has to be typed character by character.
 */
const KEYS: Array<{ token: string; label: string; tone?: "op" | "fn" }> = [
  { token: "7", label: "7" },
  { token: "8", label: "8" },
  { token: "9", label: "9" },
  { token: "÷", label: "÷", tone: "op" },
  { token: "4", label: "4" },
  { token: "5", label: "5" },
  { token: "6", label: "6" },
  { token: "×", label: "×", tone: "op" },
  { token: "1", label: "1" },
  { token: "2", label: "2" },
  { token: "3", label: "3" },
  { token: "−", label: "−", tone: "op" },
  { token: "0", label: "0" },
  { token: ".", label: "." },
  { token: ",", label: "," },
  { token: "+", label: "+", tone: "op" },
  { token: "(", label: "(", tone: "op" },
  { token: ")", label: ")", tone: "op" },
  { token: "=", label: "=", tone: "op" },
  { token: "^", label: "xʸ", tone: "fn" },
  { token: "√", label: "√", tone: "fn" },
  { token: "π", label: "π", tone: "fn" },
  { token: "x", label: "x", tone: "fn" },
];

export function MathPad({
  value,
  onChange,
  onEnter,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fractionOpen, setFractionOpen] = useState(false);
  const [numerator, setNumerator] = useState("");
  const [denominator, setDenominator] = useState("");

  const insert = (token: string) => {
    const input = inputRef.current;
    if (!input || disabled) return;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      const caret = start + token.length;
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  };

  const backspace = () => {
    if (disabled) return;
    onChange(value.slice(0, Math.max(0, value.length - 1)));
    inputRef.current?.focus();
  };

  const insertFraction = () => {
    const num = numerator.trim();
    const den = denominator.trim();
    if (!num || !den) return;
    insert(`(${num}/${den})`);
    setNumerator("");
    setDenominator("");
    setFractionOpen(false);
  };

  return (
    <div className="math-pad">
      <input
        ref={inputRef}
        className="math-pad-field"
        dir="ltr"
        value={value}
        disabled={disabled}
        placeholder="3/4 ÷ 2/5 = ..."
        aria-label="اكتب الجواب بالحساب"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter?.();
          }
        }}
      />

      {fractionOpen ? (
        <div className="fraction-composer" dir="ltr">
          <div className="fraction-stack">
            <input
              className="fraction-input"
              dir="ltr"
              autoFocus
              inputMode="decimal"
              placeholder="البسط"
              aria-label="البسط"
              value={numerator}
              onChange={(event) => setNumerator(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") insertFraction();
              }}
            />
            <span className="fraction-bar" aria-hidden="true" />
            <input
              className="fraction-input"
              dir="ltr"
              inputMode="decimal"
              placeholder="المقام"
              aria-label="المقام"
              value={denominator}
              onChange={(event) => setDenominator(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") insertFraction();
              }}
            />
          </div>
          <div className="fraction-actions">
            <button type="button" className="math-key math-key-ok" onClick={insertFraction} disabled={disabled}>
              إدراج
            </button>
            <button type="button" className="math-key" onClick={() => setFractionOpen(false)}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="math-pad-keys">
          {KEYS.map((key) => (
            <button
              key={key.token}
              type="button"
              className={`math-key${key.tone ? ` math-key-${key.tone}` : ""}`}
              disabled={disabled}
              onClick={() => insert(key.token)}
            >
              {key.label}
            </button>
          ))}
          <button
            type="button"
            className="math-key math-key-fn"
            disabled={disabled}
            onClick={() => setFractionOpen(true)}
            title="كسر"
          >
            a/b
          </button>
          <button type="button" className="math-key math-key-fn" disabled={disabled} onClick={backspace} title="مسح آخر رمز">
            ⌫
          </button>
        </div>
      )}
    </div>
  );
}
