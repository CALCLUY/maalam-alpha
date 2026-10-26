declare module "@sohumsuthar/liquid-glass" {
  import type { CSSProperties, ReactElement, ReactNode } from "react";

  export interface LiquidGlassProps {
    children?: ReactNode;
    macro?: boolean;
    variant?: "clear" | "regular";
    dimmed?: boolean;
    interactive?: boolean;
    lens?: boolean;
    lensOptions?: {
      bezel?: number;
      refraction?: number;
      dispersion?: number;
      radius?: number;
      maxTexture?: number;
    };
    mobileFlat?: boolean;
    className?: string;
    style?: CSSProperties;
    contentClassName?: string;
    contentStyle?: CSSProperties;
  }

  export function LiquidGlass(props: LiquidGlassProps): ReactElement | null;
}
