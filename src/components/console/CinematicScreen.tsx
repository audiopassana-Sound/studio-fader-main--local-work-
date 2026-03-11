import { memo, useRef, useEffect, useCallback, useMemo, useState } from "react";
import yanivBg from "@/assets/yaniv-bg.png";
import { toYouTubeEmbedBaseUrl } from "@/lib/youtube";
import AudioVisualizer from "./AudioVisualizer";
import ScreenHeader from "./ScreenHeader";
import ScrubBar from "./ScrubBar";

interface ScreenLayer {
  label: string;
  opacity: number;
  color: string;
}

interface CinematicScreenProps {
  layers: ScreenLayer[];
  masterBrightness: number;
  analyserNode: AnalyserNode | null;
  videoUrl?: string;
  isPlaying?: boolean;
  onVideoEnded?: () => void;
  /** 0-100 volume for YouTube iframe */
  volume?: number;
  /** 0-1 amplitude for visualizer */
  amplitude?: number;
}

// Non-linear curve: fader at ~20% → video fully visible
function videoOpacity(faderNorm: number): number {
  if (faderNorm <= 0) return 0;
  return Math.min(1, Math.pow(faderNorm / 0.2, 2.5));
}

const CinematicScreen = memo(
  ({ layers, masterBrightness, analyserNode, videoUrl, isPlaying, onVideoEnded, volume = 75, amplitude = 0 }: CinematicScreenProps) => {
    const maxLayerOpacity = Math.max(0, ...layers.map((l) => l.opacity));
    const hasActive = maxLayerOpacity > 0;

    // Drive video visibility directly from the most-active fader so the "-8dB / 20%" rule feels immediate.
    const screenOpacity = videoOpacity(maxLayerOpacity) * masterBrightness;
    const videoFullyVisible = screenOpacity >= 0.95;
    const showVideo = !!videoUrl;

    const isYouTubeSource = useMemo(() => {
      if (!videoUrl) return false;
      return /youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(videoUrl);
    }, [videoUrl]);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const prevPlaying = useRef<boolean | undefined>(undefined);

    // Scrubber state
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const sendYTCommand = useCallback(
      (command: string, args: unknown[] = []) => {
        if (!isYouTubeSource) return;
        const win = iframeRef.current?.contentWindow;
        if (!win) return;

        // YouTube IFrame API postMessage format
        const payload = {
          event: "command",
          func: command,
          args: args.length ? args : "",
        };

        win.postMessage(JSON.stringify(payload), "*");
      },
      [isYouTubeSource]
    );

    // Send play/pause whenever isPlaying changes
    useEffect(() => {
      if (prevPlaying.current === isPlaying) return;
      prevPlaying.current = isPlaying;

      if (isYouTubeSource) {
        sendYTCommand(isPlaying ? "playVideo" : "pauseVideo");
        return;
      }

      const el = videoRef.current;
      if (!el) return;

      if (isPlaying) {
        void el.play().catch(() => {
          // Ignore autoplay policy errors; next user gesture will resume
        });
      } else {
        el.pause();
      }
    }, [isPlaying, isYouTubeSource, sendYTCommand]);


  // Re-send playVideo after iframe loads if already supposed to be playing
  const onIframeLoad = useCallback(() => {
    if (!isYouTubeSource) return;
    setTimeout(() => {
      // If we're supposed to be playing when iframe loads, force play
      if (isPlaying) {
        sendYTCommand("playVideo");
      }
    }, 350);
  }, [sendYTCommand, isPlaying, isYouTubeSource]);


  // Sync volume to YouTube iframe or direct video element
  useEffect(() => {
    if (isYouTubeSource) {
      sendYTCommand("setVolume", [Math.round(volume)]);
      return;
    }

    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    }
  }, [volume, sendYTCommand, isYouTubeSource]);

  // Listen for YouTube iframe messages: ended state, current time, duration
  useEffect(() => {
    if (!isYouTubeSource) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        // ended state
        if (data?.event === "onStateChange" && data?.info === 0) {
          onVideoEnded?.();
        }
        if (data?.event === "infoDelivery" && data?.info?.playerState === 0) {
          onVideoEnded?.();
        }
        // Track progress from infoDelivery
        if (data?.event === "infoDelivery") {
          if (typeof data.info?.currentTime === "number" && typeof data.info?.duration === "number" && data.info.duration > 0) {
            setDuration(data.info.duration);
            setProgress(data.info.currentTime / data.info.duration);
          } else if (typeof data.info?.currentTime === "number" && duration > 0) {
            setProgress(data.info.currentTime / duration);
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onVideoEnded, duration, isYouTubeSource]);

  const handleSeek = useCallback((fraction: number) => {
    if (duration <= 0) return;
    const seekTime = fraction * duration;

    if (isYouTubeSource) {
      sendYTCommand("seekTo", [seekTime, true]);
    } else if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }

    setProgress(fraction);
  }, [duration, sendYTCommand, isYouTubeSource]);

  const embedUrl = useMemo(() => {
    if (!videoUrl || !isYouTubeSource) return "";

    const base = toYouTubeEmbedBaseUrl(videoUrl);
    if (!base) return "";

    const u = new URL(base);
    u.searchParams.set("enablejsapi", "1");
    u.searchParams.set("playsinline", "1");
    u.searchParams.set("origin", window.location.origin);
    u.searchParams.set("modestbranding", "1");
    u.searchParams.set("rel", "0");
    return u.toString();
  }, [videoUrl, isYouTubeSource]);

  // Visualizer opacity: fade out as video fades in, fully gone when video is opaque
  const vizOpacity = hasActive ? Math.max(0, 1 - screenOpacity * 1.5) : 1;

  return (
    <div className="flex flex-col w-full h-full">
      <div className="screen-area relative flex-1 min-h-0 overflow-hidden rounded-sm">
        {/* Base Layer: Artistic background */}
        <div className="absolute inset-0 z-0">
          <img src={yanivBg} alt="Studio background" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(220 20% 4% / 0.3) 0%, hsl(220 20% 4% / 0.15) 50%, hsl(220 20% 4% / 0.4) 100%)",
            }}
          />
        </div>


        {/* Audio Visualizer */}
        {!videoFullyVisible && (
          <div
            className="absolute inset-0 z-[3] transition-opacity duration-500"
            style={{ opacity: vizOpacity }}
          >
            <AudioVisualizer analyserNode={analyserNode} masterBrightness={masterBrightness} amplitude={amplitude} />
          </div>
        )}

        {/* Header */}
        <ScreenHeader />

        {/* Cinema Screen Container */}
        {showVideo && (
          <div
            className="absolute inset-0 z-[4] flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: hasActive ? screenOpacity : 0, pointerEvents: hasActive ? "auto" : "none" }}
          >
            <div
              className="relative w-[78%] max-h-[85%] rounded-sm overflow-hidden"
              style={{
                aspectRatio: "16 / 9",
                background: "hsl(0 0% 0%)",
                boxShadow: "0 8px 40px hsl(0 0% 0% / 0.7), 0 2px 12px hsl(0 0% 0% / 0.5)",
              }}
            >
              {isYouTubeSource ? (
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  onLoad={onIframeLoad}
                />
              ) : (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-cover"
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    const nextDuration = Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0;
                    setDuration(nextDuration);
                  }}
                  onTimeUpdate={(e) => {
                    const d = e.currentTarget.duration;
                    const t = e.currentTarget.currentTime;
                    if (Number.isFinite(d) && d > 0) {
                      setDuration(d);
                      setProgress(t / d);
                    }
                  }}
                  onEnded={() => onVideoEnded?.()}
                />
              )}
            </div>
          </div>
        )}

        {/* Project color layers */}
        {layers.map((layer, i) => (
          <div
            key={i}
            className="absolute inset-0 z-[5] transition-opacity duration-300"
            style={{
              opacity: layer.opacity * masterBrightness,
              background: layer.color,
              mixBlendMode: "screen",
            }}
          />
        ))}

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{ background: "radial-gradient(ellipse at center, transparent 40%, hsl(220 20% 2%) 100%)" }}
        />

        {/* Scan lines */}
        <div
          className="absolute inset-0 pointer-events-none z-10 opacity-[0.025]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 0%) 2px, hsl(0 0% 0%) 4px)" }}
        />

        {/* Idle hint */}
        {!hasActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 z-30">
            <div className="text-led text-foreground/30 text-xs tracking-widest animate-pulse">
              PUSH FADERS TO ACTIVATE
            </div>
          </div>
        )}

        {/* Active channel indicators */}
        {hasActive && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-30">
            {layers.map((layer, i) =>
              layer.opacity > 0 ? (
                <span key={i} className="text-led text-foreground/60" style={{ opacity: layer.opacity * masterBrightness }}>
                  {layer.label}
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Master brightness overlay */}
        <div
          className="absolute inset-0 bg-background pointer-events-none z-[15] transition-opacity duration-150"
          style={{ opacity: 1 - masterBrightness }}
        />
      </div>

      {/* Scrub bar beneath the screen */}
      <ScrubBar
        progress={progress}
        duration={duration}
        onSeek={handleSeek}
        visible={showVideo && duration > 0}
      />
    </div>
  );
});

CinematicScreen.displayName = "CinematicScreen";
export default CinematicScreen;
