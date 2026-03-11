import { memo, useCallback, useRef } from "react";

interface PanKnobProps {
  value?: number; // -100 to 100, 0 = center
  onChange?: (value: number) => void;
}

const PanKnob = memo(({ value = 0, onChange }: PanKnobProps) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  // Map -100..100 to -135deg..135deg
  const angle = (value / 100) * 135;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Alt+click = reset to center
      if (e.altKey && onChange) {
        onChange(0);
        return;
      }
      isDragging.current = true;
      startY.current = e.clientY;
      startValue.current = value;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [value, onChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || !onChange) return;
      const delta = (startY.current - e.clientY) * 1.5;
      const newVal = Math.max(-100, Math.min(100, startValue.current + delta));
      onChange(Math.round(newVal));
    },
    [onChange]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const panLabel =
    value === 0 ? "C" : value < 0 ? `L${Math.abs(value)}` : `R${value}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-led text-muted-foreground">PAN</span>
      <div
        ref={knobRef}
        className="relative w-7 h-7 rounded-full bg-secondary border border-console-strip-border shadow-inner cursor-ns-resize select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="Drag to pan · Alt+Click to center"
      >
        <div className="absolute inset-0.5 rounded-full bg-gradient-to-b from-muted to-secondary">
          <div
            className="absolute top-0.5 left-1/2 w-0.5 h-2.5 -translate-x-1/2 origin-bottom rounded-full bg-primary"
            style={{
              transform: `translateX(-50%) rotate(${angle}deg)`,
              transformOrigin: "50% 100%",
              top: "2px",
            }}
          />
        </div>
      </div>
      <span className="text-led text-muted-foreground/60 text-[0.5rem]">
        {panLabel}
      </span>
    </div>
  );
});

PanKnob.displayName = "PanKnob";
export default PanKnob;
