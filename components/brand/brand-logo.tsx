import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div
      className={cn("brand-mark h-10 w-10 rounded-[10px]", className)}
      role="img"
      aria-label="CPEC 视频速览"
    >
      <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">
        <path
          d="M18 72H38"
          fill="none"
          stroke="#fffaf0"
          strokeLinecap="round"
          strokeWidth="6"
          opacity="0.72"
        />
        <path
          d="M62 24C74 32 81 45 80 58C79 66 76 72 70 78"
          fill="none"
          stroke="#4cc39f"
          strokeLinecap="round"
          strokeWidth="5"
          opacity="0.88"
        />
        <path d="M63 18L79 28L63 38Z" fill="#e6b766" />
        <circle cx="72" cy="72" r="5" fill="#4cc39f" />
        <text
          x="43"
          y="65"
          fill="#fffaf0"
          fontFamily="'Songti SC','STSong','Noto Serif SC',serif"
          fontSize="46"
          fontWeight="800"
          textAnchor="middle"
        >
          智
        </text>
      </svg>
    </div>
  );
}
