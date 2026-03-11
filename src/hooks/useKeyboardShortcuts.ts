import { useEffect } from "react";

interface ShortcutActions {
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onMuteActive: () => void;
}

export function useKeyboardShortcuts({ onPlayPause, onNext, onPrev, onMuteActive }: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          onPlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          onNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          onPrev();
          break;
        case "KeyM":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            onMuteActive();
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPlayPause, onNext, onPrev, onMuteActive]);
}
