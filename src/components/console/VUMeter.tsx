import { memo, useEffect, useMemo, useRef } from "react";

interface VUMeterProps {
  /** 0-100 */
  level?: number;
  /** Optional getter; when provided, the meter updates itself at 60fps without parent re-renders */
  levelSource?: () => number;
  active?: boolean;
}

const SEGMENT_COUNT = 16;

const VUMeter = memo(({ level = 0, levelSource, active }: VUMeterProps) => {
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const lastRoundedRef = useRef<number>(-1);
  const lastActiveRef = useRef<boolean>(false);

  const segmentMeta = useMemo(() => {
    return Array.from({ length: SEGMENT_COUNT }, (_, i) => {
      const segmentThreshold = ((SEGMENT_COUNT - 1 - i) / SEGMENT_COUNT) * 100;
      const ratio = (SEGMENT_COUNT - 1 - i) / SEGMENT_COUNT;

      // Top 2 segments (ratio > 0.85) = RED peak indicators
      // Next band (ratio > 0.7) = yellow
      // Rest = green
      let colorClass: string;
      if (ratio > 0.85) colorClass = "led-glow-red";
      else if (ratio > 0.7) colorClass = "led-glow-yellow";
      else colorClass = "led-glow-green";

      return { segmentThreshold, colorClass };
    });
  }, []);

  useEffect(() => {
    const getLevel = () => {
      try {
        return levelSource ? levelSource() : level;
      } catch {
        return 0;
      }
    };

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);

      const nextLevel = getLevel();
      const nextActive = typeof active === "boolean" ? active : nextLevel > 0;

      const rounded = Math.round(nextLevel);
      if (rounded === lastRoundedRef.current && nextActive === lastActiveRef.current) return;
      lastRoundedRef.current = rounded;
      lastActiveRef.current = nextActive;

      for (let i = 0; i < SEGMENT_COUNT; i++) {
        const el = segmentRefs.current[i];
        if (!el) continue;

        const { segmentThreshold, colorClass } = segmentMeta[i];
        const isLit = nextActive && nextLevel > segmentThreshold;

        // Avoid classList churn: overwrite once.
        el.className = `vu-segment w-2 h-1.5 rounded-[1px] ${isLit ? colorClass : "led-off"}`;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [level, levelSource, active, segmentMeta]);

  return (
    <div className="flex flex-col gap-[2px] py-1">
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(node) => {
            segmentRefs.current[i] = node;
          }}
          className="vu-segment w-2 h-1.5 rounded-[1px] led-off"
        />
      ))}
    </div>
  );
});

VUMeter.displayName = "VUMeter";
export default VUMeter;
