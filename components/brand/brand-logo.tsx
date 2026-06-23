import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      role="img"
      aria-label="视频速览"
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        {/* 外圆环 */}
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          opacity="0.9"
        />
        {/* 内圆环 */}
        <circle
          cx="20"
          cy="20"
          r="12"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity="0.3"
        />
        {/* 播放三角形 */}
        <path
          d="M16 14L26 20L16 26Z"
          fill="currentColor"
          opacity="0.9"
        />
      </svg>
    </div>
  );
}
