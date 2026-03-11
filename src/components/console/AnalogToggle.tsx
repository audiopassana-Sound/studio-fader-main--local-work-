import { memo } from "react";

type Category = "recordings" | "post";

interface AnalogToggleProps {
  value: Category;
  onChange: (value: Category) => void;
}

const AnalogToggle = memo(({ value, onChange }: AnalogToggleProps) => {
  const isRight = value === "post";

  return (
    <div className="flex items-center gap-3 select-none">
      {/* Left label */}
      <span
        className={`text-led font-semibold transition-all duration-200 cursor-pointer ${
          !isRight ? "text-primary" : "text-muted-foreground"
        }`}
        onClick={() => onChange("recordings")}
      >
        Recordings & Mixes
      </span>

      {/* Toggle housing */}
      <button
        onClick={() => onChange(isRight ? "recordings" : "post")}
        className="relative w-14 h-7 rounded-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          background: "linear-gradient(180deg, hsl(0 0% 10%) 0%, hsl(0 0% 18%) 50%, hsl(0 0% 12%) 100%)",
          boxShadow: "inset 0 2px 6px hsl(0 0% 0% / 0.6), 0 1px 0 hsl(0 0% 25% / 0.3)",
          border: "1px solid hsl(0 0% 22%)",
        }}
      >
        {/* Track groove */}
        <div
          className="absolute inset-x-1.5 top-1/2 -translate-y-1/2 h-1 rounded-full"
          style={{
            background: "hsl(0 0% 6%)",
            boxShadow: "inset 0 1px 2px hsl(0 0% 0% / 0.8)",
          }}
        />
        {/* Metal lever */}
        <div
          className="absolute top-1 h-5 w-5 rounded-sm transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{
            left: isRight ? "calc(100% - 1.5rem)" : "0.15rem",
            background: "linear-gradient(180deg, hsl(0 0% 72%) 0%, hsl(0 0% 55%) 40%, hsl(0 0% 65%) 60%, hsl(0 0% 50%) 100%)",
            boxShadow: "0 2px 4px hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(0 0% 80% / 0.4)",
            border: "1px solid hsl(0 0% 40%)",
          }}
        >
          {/* Grip lines */}
          <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
            <div className="h-px" style={{ background: "hsl(0 0% 45%)" }} />
            <div className="h-px" style={{ background: "hsl(0 0% 75%)" }} />
            <div className="h-px" style={{ background: "hsl(0 0% 45%)" }} />
          </div>
        </div>
      </button>

      {/* Right label */}
      <span
        className={`text-led font-semibold transition-all duration-200 cursor-pointer ${
          isRight ? "text-primary" : "text-muted-foreground"
        }`}
        onClick={() => onChange("post")}
      >
        Post Production
      </span>
    </div>
  );
});

AnalogToggle.displayName = "AnalogToggle";
export default AnalogToggle;
