import { cn } from "@/lib/utils/cn";
import Image from "next/image";

type LogoSize = "sm" | "md" | "lg";

interface GlowBookMarkProps {
  size?: LogoSize;
  className?: string;
}

const markSizes: Record<LogoSize, string> = {
  sm: "h-16 w-28",
  md: "h-20 w-32",
  lg: "h-36 w-64",
};

const nameSizes: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

export function GlowBookMark({ size = "md", className }: GlowBookMarkProps) {
  return (
    <Image
      src="/brand/dinocalendarlogo.svg"
      alt="GlowBook"
      width={600}
      height={400}
      priority={size === "lg"}
      className={cn(markSizes[size], "shrink-0 object-contain", className)}
    />
  );
}

interface GlowBookBrandProps {
  markSize?: LogoSize;
  align?: "center" | "left";
  dark?: boolean;
  className?: string;
}

export function GlowBookBrand({ markSize = "md", align = "center", dark = false, className }: GlowBookBrandProps) {
  return (
    <div
      className={cn(
        "flex min-w-0",
        align === "center" ? "flex-col items-center text-center" : "flex-col items-start text-left",
        className
      )}
    >
      <GlowBookMark size={markSize} />
      <p
        className={cn(
          "font-semibold tracking-tight leading-none",
          nameSizes[markSize],
          dark ? "text-white" : "text-stone-950",
          "mt-1"
        )}
      >
        GlowBook
      </p>
    </div>
  );
}
