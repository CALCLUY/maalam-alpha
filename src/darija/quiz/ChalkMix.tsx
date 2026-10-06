import type { ReactNode } from "react";
import katex from "katex";

/**
 * Mixed-script chalk: Arabic in Playpen Sans Arabic (same as the board),
 * French/Latin in Caveat, and $...$ math typeset with KaTeX.
 */
function renderInlineMath(source: string): string | null {
  try {
    const html = katex.renderToString(source.trim().replace(/[\$]/g, ""), {
      throwOnError: false,
      displayMode: false,
      strict: "ignore",
    });
    if (html.includes('class="katex-error"')) return null;
    return html;
  } catch {
    return null;
  }
}

export function ChalkMix({ text }: { text: string }): ReactNode {
  if (!text) return null;
  const chunks = text.split(/(\$[^$\n]+\$)/g);
  return (
    <>
      {chunks.map((chunk, chunkIdx) => {
        if (chunk.startsWith("$") && chunk.endsWith("$") && chunk.length > 2) {
          const math = chunk.slice(1, -1);
          const html = renderInlineMath(math);
          if (html) {
            return (
              <span
                key={chunkIdx}
                className="board-latex-inline"
                dir="ltr"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          return (
            <span key={chunkIdx} className="board-latin" dir="ltr">
              {math}
            </span>
          );
        }
        const parts = chunk.split(/([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+)/gu);
        return (
          <span key={chunkIdx}>
            {parts.map((segment, segIdx) => {
              if (/[\u0600-\u06FF]/.test(segment)) {
                return (
                  <span key={segIdx} className="board-arabic">
                    {segment}
                  </span>
                );
              }
              if (/[a-zA-Z]/.test(segment)) {
                return (
                  <span key={segIdx} className="board-latin">
                    {segment}
                  </span>
                );
              }
              return <span key={segIdx}>{segment}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}
