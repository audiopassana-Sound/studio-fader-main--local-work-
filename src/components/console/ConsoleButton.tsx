import { memo } from "react";

interface ConsoleButtonProps {
  label: string;
  active: boolean;
  variant: "mute" | "solo";
  onClick: () => void;
}

const ConsoleButton = memo(({ label, active, variant, onClick }: ConsoleButtonProps) => {
  const activeClass = variant === "mute" ? "led-glow-red" : "led-glow-yellow";
  const baseClass = active
    ? `${activeClass} text-primary-foreground`
    : "led-off text-muted-foreground hover:bg-muted";

  return (
    <button
      onClick={onClick}
      className={`text-led px-2 py-1 rounded-sm font-semibold transition-all duration-100 ${baseClass}`}
    >
      {label}
    </button>
  );
});

ConsoleButton.displayName = "ConsoleButton";
export default ConsoleButton;
