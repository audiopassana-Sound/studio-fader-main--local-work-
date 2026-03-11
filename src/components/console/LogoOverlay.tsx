import { memo } from "react";

const LogoOverlay = memo(() => (
  <div className="absolute inset-0 z-[25] flex flex-col items-center justify-center pointer-events-none select-none">
    <h1
      className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[0.15em] uppercase"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: "linear-gradient(180deg, hsl(0 0% 95%) 0%, hsl(0 0% 70%) 40%, hsl(38 40% 65%) 70%, hsl(0 0% 55%) 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textShadow: "none",
        filter: "drop-shadow(0 2px 12px hsl(0 0% 0% / 0.6))",
      }}
    >
      Yaniv Paz
    </h1>
    <p
      className="text-xs sm:text-sm tracking-[0.35em] uppercase mt-1"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        color: "hsl(0 0% 60%)",
        textShadow: "0 1px 8px hsl(0 0% 0% / 0.5)",
      }}
    >
      sound design
    </p>
  </div>
));

LogoOverlay.displayName = "LogoOverlay";
export default LogoOverlay;
