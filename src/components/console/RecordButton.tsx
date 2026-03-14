import { memo, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface RecordButtonProps {
  isPlaying: boolean;
  onBeforeNavigate?: () => void;
}

const RecordButton = memo(({ isPlaying, onBeforeNavigate }: RecordButtonProps) => {
  const navigate = useNavigate();
  const [fading, setFading] = useState(false);
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
        navigateTimeoutRef.current = null;
      }
    };
  }, []);

  const handleClick = useCallback(() => {
    if (fading) return;
    onBeforeNavigate?.();
    setFading(true);
    navigateTimeoutRef.current = setTimeout(() => {
      navigate("/");
    }, 800);
  }, [fading, navigate, onBeforeNavigate]);

  return (
    <>
      {/* The record button */}
      <button
        onClick={handleClick}
        aria-disabled={fading}
        className="group relative flex items-center gap-3 px-7 py-3 rounded-full transition-all duration-300 pointer-events-auto z-[130]
          appearance-none border-none shadow-none focus:shadow-none
          bg-transparent !bg-opacity-0 hover:bg-transparent active:bg-transparent
          focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0
          hover:shadow-[0_0_24px_hsl(0_85%_55%/0.25)]
          active:scale-95"
        style={{ WebkitTapHighlightColor: "transparent" }}
        aria-label="Press Record — go to The Stage"
      >
        {/* Animated red border: pulses in sync with dot when NOT playing */}
        <span
          className={`pointer-events-none absolute inset-0 rounded-full border-2 ${
            isPlaying ? "border-destructive" : "border-destructive record-pulse"
          }`}
          aria-hidden="true"
        />

        {/* Record dot: pulses only when NOT playing */}
        <span className="relative flex h-4 w-4">
          {!isPlaying && (
            <span className="absolute inset-0 rounded-full bg-destructive record-pulse opacity-70" />
          )}
          <span className="relative inline-flex h-5 w-5 rounded-full bg-destructive shadow-[0_0_12px_3px_hsl(0_85%_55%/0.65)]" />
        </span>
        <span
          className="text-led text-foreground/70 group-hover:text-foreground transition-colors duration-300"
          style={{ fontSize: "0.96rem", letterSpacing: "0.14em" }}
        >
          PRESS RECORD
        </span>
      </button>
    </>
  );
});

RecordButton.displayName = "RecordButton";
export default RecordButton;
