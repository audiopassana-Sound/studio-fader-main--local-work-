import { memo, useEffect, useState, type MutableRefObject } from "react";
import { SkipBack, Play, Pause, SkipForward } from "lucide-react";

interface TransportControlsProps {
  isPlaying: boolean;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  projectLabel?: string;
  /**
   * Parent-owned ref used to trigger a one-shot pulse without forcing a parent re-render.
   * (Avoids Fast Refresh hook-queue issues.)
   */
  pulseTriggerRef?: MutableRefObject<(() => void) | null>;
}

const transportBtnStyle = {
  background: "linear-gradient(180deg, hsl(0 0% 22%) 0%, hsl(0 0% 14%) 50%, hsl(0 0% 18%) 100%)",
  boxShadow:
    "inset 0 1px 0 hsl(0 0% 30% / 0.4), 0 3px 8px hsl(0 0% 0% / 0.5), 0 1px 2px hsl(0 0% 0% / 0.3)",
  border: "1px solid hsl(0 0% 24%)",
};

const transportBtnActiveStyle = {
  background: "linear-gradient(180deg, hsl(0 0% 16%) 0%, hsl(0 0% 10%) 50%, hsl(0 0% 14%) 100%)",
  boxShadow: "inset 0 2px 4px hsl(0 0% 0% / 0.6), 0 0px 0px hsl(0 0% 0% / 0)",
};

const TransportControls = memo(
  ({ isPlaying, onPrev, onPlayPause, onNext, projectLabel, pulseTriggerRef }: TransportControlsProps) => {
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
      if (!pulseTriggerRef) return;

      let t: ReturnType<typeof setTimeout> | null = null;

      const trigger = () => {
        setPulse(true);
        if (t) clearTimeout(t);
        t = setTimeout(() => setPulse(false), 700);
      };

      pulseTriggerRef.current = trigger;

      return () => {
        if (t) clearTimeout(t);
        if (pulseTriggerRef.current === trigger) pulseTriggerRef.current = null;
      };
    }, [pulseTriggerRef]);

    return (
      <div className="flex items-center gap-4">
        {/* Prev */}
        <button
          onClick={onPrev}
          className="w-10 h-8 rounded-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-100 active:scale-95"
          style={transportBtnStyle}
          onMouseDown={(e) => Object.assign(e.currentTarget.style, transportBtnActiveStyle)}
          onMouseUp={(e) => Object.assign(e.currentTarget.style, transportBtnStyle)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, transportBtnStyle)}
          title="Previous project (←)"
        >
          <SkipBack size={16} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className={`relative w-12 h-10 rounded-sm flex items-center justify-center transition-all duration-100 active:scale-95 ${
            isPlaying ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
          style={{
            ...transportBtnStyle,
            ...(isPlaying
              ? {
                  boxShadow: `inset 0 1px 0 hsl(0 0% 30% / 0.4), 0 3px 8px hsl(0 0% 0% / 0.5), 0 0 12px hsl(var(--primary) / 0.2)`,
                }
              : {}),
          }}
          onMouseDown={(e) => Object.assign(e.currentTarget.style, transportBtnActiveStyle)}
          onMouseUp={(e) => Object.assign(e.currentTarget.style, transportBtnStyle)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, transportBtnStyle)}
          title="Play / Pause (Space)"
        >
          {pulse && !isPlaying && (
            <span
              className="absolute inset-0 rounded-sm animate-ping [animation-duration:650ms] [animation-iteration-count:1]"
              style={{ boxShadow: "0 0 0 2px hsl(var(--primary) / 0.35)" }}
            />
          )}
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          className="w-10 h-8 rounded-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-100 active:scale-95"
          style={transportBtnStyle}
          onMouseDown={(e) => Object.assign(e.currentTarget.style, transportBtnActiveStyle)}
          onMouseUp={(e) => Object.assign(e.currentTarget.style, transportBtnStyle)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, transportBtnStyle)}
          title="Next project (→)"
        >
          <SkipForward size={16} />
        </button>

        {/* Project label */}
        {projectLabel && (
          <span className="text-led text-primary/80 ml-2 truncate max-w-[200px]">{projectLabel}</span>
        )}
      </div>
    );
  }
);

TransportControls.displayName = "TransportControls";
export default TransportControls;

