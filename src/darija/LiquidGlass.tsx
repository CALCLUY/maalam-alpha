import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Local copy of the small parts of `@sohumsuthar/liquid-glass@3.1.0` this app
 * uses (MIT, https://github.com/sohumsuthar/liquid-glass).
 *
 * Why it lives here: the app is compiled live from GitHub through esm.sh. The
 * published package ships its hook as `.jsx`, and esm.sh's non-bundle build now
 * fails to parse that file (`cjsModuleLexer: failed to parse module`). That
 * made every submodule 404/500 and the whole app fail to import. Keeping the
 * component in a `.tsx` file removes the broken CDN dependency while preserving
 * the exact four-layer markup and the per-element refraction lens.
 */

/* ----------------------------- optics ---------------------------------- */

const N_D = 1.5168;
const N_C = 1.5143;
const N_F = 1.5224;

type Surface = (x: number) => number;

const squircle: Surface = (x) => Math.pow(1 - Math.pow(1 - x, 4), 0.25);

type DispersionScales = { red: number; green: number; blue: number };

function dispersionScales(strength = 1): DispersionScales {
  const r = (N_C - 1) / (N_D - 1);
  const b = (N_F - 1) / (N_D - 1);
  return {
    red: 1 + (r - 1) * strength,
    green: 1,
    blue: 1 + (b - 1) * strength,
  };
}

function derivative(f: Surface, x: number, h = 1e-4): number {
  const a = Math.max(0, x - h);
  const b = Math.min(1, x + h);
  return (f(b) - f(a)) / (b - a);
}

function fresnelReflectance(thetaI: number, n = N_D): number {
  const ci = Math.cos(thetaI);
  const st = Math.sin(thetaI) / n;
  if (st >= 1) return 1;
  const ct = Math.sqrt(1 - st * st);
  const rs = (ci - n * ct) / (ci + n * ct);
  const rp = (n * ci - ct) / (n * ci + ct);
  return 0.5 * (rs * rs + rp * rp);
}

type LUTOptions = { baseT?: number; fresnelFade?: boolean };

function displacementProfile(x: number, options: LUTOptions = {}): number {
  const { baseT = 0.35, fresnelFade = true } = options;
  const slope = derivative(squircle, x);
  const thetaS = Math.atan(slope);
  const thetaR = Math.asin(Math.sin(thetaS) / N_D);
  const t = baseT + squircle(x);
  let d = t * Math.tan(thetaS - thetaR);
  if (fresnelFade) d *= 1 - fresnelReflectance(thetaS, N_D);
  return d;
}

type LUT = { lut: Float32Array; peak: number };

function buildDisplacementLUT(samples = 255, options: LUTOptions = {}): LUT {
  const lut = new Float32Array(samples + 1);
  let peak = 0;
  for (let i = 0; i <= samples; i += 1) {
    const d = displacementProfile(i / samples, options);
    lut[i] = d;
    if (d > peak) peak = d;
  }
  for (let i = 0; i <= samples; i += 1) lut[i] /= peak;
  return { lut, peak };
}

function sampleLUT(lut: Float32Array, t: number): number {
  const s = lut.length - 1;
  const ft = Math.min(1, Math.max(0, t)) * s;
  const i = Math.floor(ft);
  const j = Math.min(s, i + 1);
  const frac = ft - i;
  return lut[i] * (1 - frac) + lut[j] * frac;
}

function sdfRoundedRect(px: number, py: number, w: number, h: number, r: number): number {
  const qx = Math.abs(px - w / 2) - w / 2 + r;
  const qy = Math.abs(py - h / 2) - h / 2 + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

function sdfGradient(
  px: number,
  py: number,
  w: number,
  h: number,
  r: number,
  e = 0.75,
): { x: number; y: number } {
  const dx = sdfRoundedRect(px + e, py, w, h, r) - sdfRoundedRect(px - e, py, w, h, r);
  const dy = sdfRoundedRect(px, py + e, w, h, r) - sdfRoundedRect(px, py - e, w, h, r);
  const mag = Math.hypot(dx, dy) || 1;
  return { x: dx / mag, y: dy / mag };
}

type MapOptions = {
  width: number;
  height: number;
  radius: number;
  bezel: number;
  lut: Float32Array;
  channelDepth?: number;
};

function renderDisplacementMap(data: Uint8ClampedArray, options: MapOptions): Uint8ClampedArray {
  const { width, height, radius, bezel, lut, channelDepth = 127 } = options;
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const idx = (py * width + px) * 4;
      let r = 128;
      let g = 128;
      const dist = -sdfRoundedRect(px + 0.5, py + 0.5, width, height, radius);
      if (dist > 0 && dist < bezel) {
        const mag = sampleLUT(lut, dist / bezel);
        const nrm = sdfGradient(px + 0.5, py + 0.5, width, height, radius);
        r = Math.round(128 - nrm.x * mag * channelDepth);
        g = Math.round(128 - nrm.y * mag * channelDepth);
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
      }
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }
  return data;
}

/* ------------------------------ lens ------------------------------------ */

let sharedLUT: LUT | null = null;

function getLUT(): LUT {
  if (!sharedLUT) sharedLUT = buildDisplacementLUT(255);
  return sharedLUT;
}

function generateMapDataURL(
  w: number,
  h: number,
  radius: number,
  bezel: number,
  maxTexture: number,
): string {
  const k = Math.max(1, Math.max(w, h) / maxTexture);
  const mw = Math.max(2, Math.round(w / k));
  const mh = Math.max(2, Math.round(h / k));
  const canvas = document.createElement("canvas");
  canvas.width = mw;
  canvas.height = mh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(mw, mh);
  renderDisplacementMap(img.data, {
    width: mw,
    height: mh,
    radius: radius / k,
    bezel: bezel / k,
    lut: getLUT().lut,
  });
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export type LiquidLensOptions = {
  bezel?: number;
  refraction?: number;
  dispersion?: number;
  radius?: number;
  maxTexture?: number;
};

type LensState = { href: string; w: number; h: number };

function useLiquidLens(
  ref: RefObject<HTMLElement | null>,
  options: LiquidLensOptions = {},
): { filter: string; svg: ReactElement | null } {
  const { bezel = 14, refraction = 1, dispersion = 8, radius, maxTexture = 1024 } = options;
  const reactId = useId();
  const id = `lg-lens-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [state, setState] = useState<LensState | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    let raf: number | null = null;
    let last = { w: 0, h: 0 };

    const regenerate = () => {
      raf = null;
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (!w || !h || (w === last.w && h === last.h)) return;
      last = { w, h };
      const r = radius ?? (parseFloat(getComputedStyle(el).borderRadius) || 22);
      const clampedR = Math.min(r, w / 2, h / 2);
      const clampedBezel = Math.min(bezel, w / 2, h / 2);
      const href = generateMapDataURL(w, h, clampedR, clampedBezel, maxTexture);
      if (href) setState({ href, w, h });
    };

    const schedule = () => {
      if (raf === null) raf = requestAnimationFrame(regenerate);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    schedule();
    return () => {
      ro.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [ref, bezel, radius, maxTexture]);

  if (!state) return { filter: "", svg: null };

  const { href, w, h } = state;
  const { peak } = getLUT();
  const clampedBezel = Math.min(bezel, w / 2, h / 2);
  const scale = 2.008 * peak * clampedBezel * refraction;
  const ca = dispersionScales(dispersion);

  const svg = (
    <svg
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
      aria-hidden="true"
    >
      <filter
        id={id}
        x="0"
        y="0"
        width={w}
        height={h}
        filterUnits="userSpaceOnUse"
        primitiveUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feImage href={href} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
        {dispersion > 0 ? (
          <>
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale * ca.red}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispR"
            />
            <feColorMatrix
              in="dispR"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="chR"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispG"
            />
            <feColorMatrix
              in="dispG"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="chG"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale * ca.blue}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispB"
            />
            <feColorMatrix
              in="dispB"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="chB"
            />
            <feBlend in="chR" in2="chG" mode="screen" result="rg" />
            <feBlend in="rg" in2="chB" mode="screen" />
          </>
        ) : (
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        )}
      </filter>
    </svg>
  );

  return { filter: `url(#${id})`, svg };
}

/* --------------------------- component ---------------------------------- */

export interface LiquidGlassProps {
  children?: ReactNode;
  macro?: boolean;
  variant?: "clear" | "regular";
  dimmed?: boolean;
  interactive?: boolean;
  lens?: boolean;
  lensOptions?: LiquidLensOptions;
  mobileFlat?: boolean;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
}

export function LiquidGlass({
  macro = false,
  variant = "clear",
  dimmed = false,
  interactive = false,
  lens = false,
  lensOptions,
  mobileFlat = false,
  className = "",
  style,
  contentClassName = "",
  contentStyle,
  children,
  ...rest
}: LiquidGlassProps & Omit<HTMLAttributes<HTMLDivElement>, keyof LiquidGlassProps>) {
  const ref = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLElement | null>(null);
  const lensState = useLiquidLens(lens ? ref : emptyRef, {
    bezel: macro ? 20 : 14,
    ...lensOptions,
  });

  const classes = ["liquid-glass"];
  if (macro) classes.push("lg-macro");
  if (variant === "regular") classes.push("lg-regular");
  if (dimmed) classes.push("lg-dimmed");
  if (interactive) classes.push("lg-interactive");
  if (mobileFlat) classes.push("lg-mobile-flat");
  if (className) classes.push(className);

  const mergedStyle =
    lens && lensState.filter
      ? ({ ...style, "--lg-refract": lensState.filter } as CSSProperties)
      : style;

  return (
    <div ref={ref} className={classes.join(" ")} style={mergedStyle} {...rest}>
      {lens ? lensState.svg : null}
      <div className="liquid-glass-effect" />
      <div className="liquid-glass-tint" />
      <div className="liquid-glass-shine" />
      <div className={`liquid-glass-content ${contentClassName}`} style={contentStyle}>
        {children}
      </div>
    </div>
  );
}

export default LiquidGlass;
