import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div
      className={cn("brand-mark h-8 w-8 rounded-[8px]", className)}
      role="img"
      aria-label="Video Analyzer"
    >
      <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false" className="h-3/4 w-3/4">
        <g fill="currentColor">
          <rect x="120" y="216" width="40" height="80" rx="10" />
          <rect x="180" y="176" width="40" height="160" rx="10" />
          <rect x="240" y="136" width="40" height="240" rx="10" />
        </g>
        <path d="M330 176L406 256L330 336Z" fill="currentColor" />
      </svg>
    </div>
  );
}
