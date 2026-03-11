import { useCallback, useRef, useEffect, memo } from "react";

interface FaderProps {
  value: number;
  onChange: (value: number) => void;
  motorized?: boolean;
}

const Fader = memo(({ value, onChange, motorized }: FaderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const thumbRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const lastCommitted = useRef(value);

  // Sync DOM directly for motorized/external updates when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      lastCommitted.current = value;
      if (thumbRef.current) {
        thumbRef.current.style.top = `${100 - value}%`;
        thumbRef.current.style.transition = motorized
          ? "top 1.5s cubic-bezier(0.25, 0.1, 0.25, 1)"
          : "none";
      }
      if (fillRef.current) {
        fillRef.current.style.height = `${value}%`;
        fillRef.current.style.transition = motorized
          ? "height 1.5s cubic-bezier(0.25, 0.1, 0.25, 1)"
          : "none";
      }
    }
  }, [value, motorized]);

  const commitValue = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(100, v));
    if (Math.abs(clamped - lastCommitted.current) > 0.3) {
      lastCommitted.current = clamped;
      onChange(clamped);
    }
  }, [onChange]);

  const updateVisual = useCallback((clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = 1 - (clientY - rect.top) / rect.height;
    const v = Math.max(0, Math.min(100, ratio * 100));

    // Direct DOM update — no React re-render
    if (thumbRef.current) {
      thumbRef.current.style.transition = "none";
      thumbRef.current.style.top = `${100 - v}%`;
    }
    if (fillRef.current) {
      fillRef.current.style.transition = "none";
      fillRef.current.style.height = `${v}%`;
    }

    commitValue(v);
  }, [commitValue]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateVisual(e.clientY);
  }, [updateVisual]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    // Keep this synchronous with the pointer event so autoplay/user-gesture
    // sensitive actions (e.g. starting media) can be triggered upstream.
    updateVisual(e.clientY);
  }, [updateVisual]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      ref={trackRef}
      className="fader-track relative w-8 h-44 rounded cursor-pointer select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Track markings */}
      {[0, 25, 50, 75, 100].map((mark) => (
        <div
          key={mark}
          className="absolute left-0 right-0 flex items-center"
          style={{ top: `${100 - mark}%` }}
        >
          <div className="w-1.5 h-px bg-muted-foreground/30" />
        </div>
      ))}

      {/* Fill */}
      <div
        ref={fillRef}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 rounded-full bg-primary/40"
        style={{ height: `${value}%` }}
      />

      {/* Thumb */}
      <div
        ref={thumbRef}
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-6 rounded-sm brushed-metal shadow-lg pointer-events-none"
        style={{ top: `${100 - value}%` }}
      >
        <div className="absolute inset-x-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-[2px]">
          <div className="h-px bg-muted-foreground/50" />
          <div className="h-px bg-muted-foreground/30" />
          <div className="h-px bg-muted-foreground/50" />
        </div>
      </div>
    </div>
  );
});

Fader.displayName = "Fader";
export default Fader;
