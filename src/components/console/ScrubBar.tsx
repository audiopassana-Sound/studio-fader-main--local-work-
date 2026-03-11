import { memo, useRef, useCallback, useEffect, useState } from "react";

interface ScrubBarProps {
  /** 0-1 progress */
  progress: number;
  /** duration in seconds */
  duration: number;
  onSeek: (fraction: number) => void;
  visible: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const ScrubBar = memo(({ progress, duration, onSeek, visible }: ScrubBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const calcFraction = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onSeek(calcFraction(e.clientX));
  }, [onSeek, calcFraction]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    onSeek(calcFraction(e.clientX));
  }, [dragging, onSeek, calcFraction]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  if (!visible) return null;

  const pct = Math.max(0, Math.min(100, progress * 100));
  const current = duration * progress;

  return (
    <div className="w-full px-3 py-1.5 flex items-center gap-2">
      <span className="text-led text-muted-foreground tabular-nums w-10 text-right">
        {formatTime(current)}
      </span>
      <div
        ref={trackRef}
        className="flex-1 h-1.5 rounded-full cursor-pointer relative group"
        style={{ background: "hsl(var(--console-fader-track))" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Filled portion */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
          style={{
            width: `${pct}%`,
            background: "hsl(var(--primary))",
            boxShadow: "0 0 6px hsl(var(--primary) / 0.4)",
          }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-[left] duration-75 opacity-0 group-hover:opacity-100"
          style={{
            left: `calc(${pct}% - 6px)`,
            background: "hsl(var(--primary))",
            boxShadow: "0 0 8px hsl(var(--primary) / 0.6)",
            ...(dragging ? { opacity: 1 } : {}),
          }}
        />
      </div>
      <span className="text-led text-muted-foreground tabular-nums w-10">
        {formatTime(duration)}
      </span>
    </div>
  );
});

ScrubBar.displayName = "ScrubBar";
export default ScrubBar;
