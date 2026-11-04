/**
 * Minimal allow-list sanitizer for model-generated SVG diagrams/flowcharts
 * before they are injected into the DOM with dangerouslySetInnerHTML.
 */
const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "ellipse",
  "defs",
  "marker",
  "lineargradient",
  "radialgradient",
  "stop",
  "title",
]);

const BLOCKED_ATTR_PREFIXES = ["on"];
const BLOCKED_ATTR_NAMES = new Set(["href", "xlink:href"]);

function sanitizeElement(node: Element): void {
  const tag = node.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    node.remove();
    return;
  }
  Array.from(node.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase();
    const value = attr.value.trim().toLowerCase();
    if (BLOCKED_ATTR_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      node.removeAttribute(attr.name);
      return;
    }
    if (BLOCKED_ATTR_NAMES.has(name)) {
      node.removeAttribute(attr.name);
      return;
    }
    if (value.startsWith("javascript:") || value.startsWith("data:text/html")) {
      node.removeAttribute(attr.name);
    }
  });
  // A label without an explicit size inherits the browser default (16 SVG
  // units) and can vanish when the diagram is scaled down on a phone. Give
  // every text node a legible chalk size unless the model chose one.
  if (tag === "text" && !node.getAttribute("font-size")) {
    node.setAttribute("font-size", "14");
  }
  Array.from(node.children).forEach((child) => sanitizeElement(child));
}

/** A model sometimes sends only the shapes or forgets the closing tag. Both are
 *  repaired here instead of rejecting a diagram the learner needs. */
function extractSvgSource(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/<svg[\s\S]*?<\/svg>/i);
  if (match) return match[0];
  if (/^<svg[\s>]/i.test(trimmed)) {
    return trimmed.endsWith("</svg>") ? trimmed : `${trimmed}</svg>`;
  }
  const hasShape = /<(g|path|line|polyline|polygon|rect|circle|ellipse|text|tspan)[\s>]/i.test(trimmed);
  if (hasShape) return `<svg viewBox="0 0 520 200">${trimmed}</svg>`;
  return "";
}

/** Returns sanitized, serialized SVG markup, or null if the input isn't usable. */
export function sanitizeSvgMarkup(raw: string): string | null {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return null;
  const source = extractSvgSource(raw);
  if (!source) return null;
  try {
    const doc = new DOMParser().parseFromString(source, "image/svg+xml");
    if (doc.querySelector("parsererror")) return null;
    const root = doc.documentElement;
    if (root.tagName.toLowerCase() !== "svg") return null;
    root.removeAttribute("width");
    root.removeAttribute("height");
    if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", "0 0 520 200");
    // Chalk defaults: a diagram must be visible even when the model forgets to
    // style every shape. Text is styled by CSS (fill: currentColor, stroke: none),
    // so these defaults only affect the geometry.
    if (!root.getAttribute("fill")) root.setAttribute("fill", "none");
    if (!root.getAttribute("stroke")) root.setAttribute("stroke", "currentColor");
    if (!root.getAttribute("stroke-width")) root.setAttribute("stroke-width", "2");
    if (!root.getAttribute("stroke-linecap")) root.setAttribute("stroke-linecap", "round");
    if (!root.getAttribute("stroke-linejoin")) root.setAttribute("stroke-linejoin", "round");
    sanitizeElement(root);
    return new XMLSerializer().serializeToString(root);
  } catch {
    return null;
  }
}
