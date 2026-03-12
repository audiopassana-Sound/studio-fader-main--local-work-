import { memo, useRef, useEffect, useCallback, useMemo, useState, type MutableRefObject } from "react";
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
  showBlankWhenNoVideo?: boolean;
  isPlaying?: boolean;
  onVideoEnded?: () => void;
  onMasterMediaEvent?: (
    event: "play" | "pause" | "seeking" | "seeked" | "waiting" | "canplay" | "time",
    currentTime: number
  ) => void;
  onMixMediaElementChange?: (element: HTMLMediaElement | null) => void;
  mixMuted?: boolean;
  /** Parent-owned ref to explicitly wake the active MIX media source. */
  mixReviveTriggerRef?: MutableRefObject<((mixVolume: number) => void) | null>;
  /** 0-100 volume for YouTube iframe */
  volume?: number;
  /** 0-1 amplitude for visualizer */
  amplitude?: number;
}

// Fade starts immediately and reaches full natural visuals at -9.0 dB.
// Channel scale is 0..100 with: dB = (value / 100) * 12 - 12
// Solving for -9.0 dB gives value = 25 => normalized target = 0.25.
// Above this target, visual intensity is capped at 1.0 while audio can still increase.
const TARGET_VISUAL_FADE = 0.25;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function videoOpacity(faderNorm: number): number {
  if (faderNorm <= 0) return 0;
  const t = clamp01(faderNorm / TARGET_VISUAL_FADE);
  // Smoothstep: starts early, feels smooth, and hard-caps at 1.0
  return t * t * (3 - 2 * t);
}

const CinematicScreen = memo(
  ({
    layers,
    masterBrightness,
    analyserNode,
    videoUrl,
    showBlankWhenNoVideo = false,
    isPlaying,
    onVideoEnded,
    onMasterMediaEvent,
    onMixMediaElementChange,
    mixMuted = false,
    mixReviveTriggerRef,
    volume = 75,
    amplitude = 0,
  }: CinematicScreenProps) => {
    const maxLayerOpacity = Math.max(0, ...layers.map((l) => l.opacity));
    const hasActive = maxLayerOpacity > 0;

    // Drive visual fade from fader with hard cap to avoid overexposure.
    const visualProgress = videoOpacity(maxLayerOpacity);
    const screenOpacity = clamp01(visualProgress * clamp01(masterBrightness));
    // Keep CSS brightness at or below natural baseline (1.0 max).
    const screenBrightness = clamp01(0.35 + visualProgress * 0.65);
    const videoFullyVisible = screenOpacity >= 0.95;
    const showVideo = !!videoUrl;

    const isYouTubeSource = useMemo(() => {
      if (!videoUrl) return false;
      return /youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(videoUrl);
    }, [videoUrl]);
    const isVimeoSource = useMemo(() => {
      if (!videoUrl) return false;
      return /vimeo\.com|player\.vimeo\.com/i.test(videoUrl);
    }, [videoUrl]);
    const isExternalIframeSource = isYouTubeSource || isVimeoSource;

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const prevPlaying = useRef<boolean | undefined>(undefined);
    const setVideoElement = useCallback(
      (element: HTMLVideoElement | null) => {
        videoRef.current = element;
        onMixMediaElementChange?.(element);
      },
      [onMixMediaElementChange]
    );

    // Scrubber state
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const sendExternalCommand = useCallback(
      (command: string, args: unknown[] = []) => {
        if (!isExternalIframeSource) return;
        const win = iframeRef.current?.contentWindow;
        if (!win) return;

        const payload = isYouTubeSource
          ? {
              event: "command",
              func: command,
              args: args.length ? args : "",
            }
          : // Vimeo player postMessage format (requires api=1)
            (args.length
              ? {
                  method: command,
                  value: args[0],
                }
              : {
                  method: command,
                });

        win.postMessage(JSON.stringify(payload), "*");
      },
      [isExternalIframeSource, isYouTubeSource]
    );

    // Send play/pause whenever isPlaying changes
    useEffect(() => {
      if (prevPlaying.current === isPlaying) return;
      prevPlaying.current = isPlaying;

      if (isExternalIframeSource) {
        if (isYouTubeSource) {
          sendExternalCommand(isPlaying ? "playVideo" : "pauseVideo");
        } else {
          sendExternalCommand(isPlaying ? "play" : "pause");
        }
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
    }, [isPlaying, isExternalIframeSource, isYouTubeSource, sendExternalCommand]);


  // Re-send play command after iframe loads if already supposed to be playing
  const onIframeLoad = useCallback(() => {
    if (!isExternalIframeSource) return;
    setTimeout(() => {
      if (isVimeoSource) {
        // Subscribe to Vimeo events so transport/progress logic mirrors YouTube behavior.
        sendExternalCommand("addEventListener", ["timeupdate"]);
        sendExternalCommand("addEventListener", ["ended"]);
        sendExternalCommand("addEventListener", ["seeked"]);
      }

      // If we're supposed to be playing when iframe loads, force play
      if (isPlaying) {
        if (isYouTubeSource) {
          sendExternalCommand("playVideo");
        } else {
          sendExternalCommand("play");
        }
      }
    }, 350);
  }, [sendExternalCommand, isPlaying, isExternalIframeSource, isYouTubeSource, isVimeoSource]);
  
  // Sync volume to external iframe. Native video mix volume is WebAudio-driven.
  useEffect(() => {
    const effectiveVolume = mixMuted ? 0 : volume;

    if (isExternalIframeSource) {
      if (isYouTubeSource) {
        sendExternalCommand("setVolume", [Math.round(effectiveVolume)]);
        if (mixMuted) sendExternalCommand("mute");
        else sendExternalCommand("unMute");
      } else {
        sendExternalCommand("setVolume", [Math.max(0, Math.min(1, effectiveVolume / 100))]);
      }
      return;
    }
  }, [volume, mixMuted, sendExternalCommand, isExternalIframeSource, isYouTubeSource]);

  // Periodic master clock ticks for drift correction of slave audio elements.
  useEffect(() => {
    if (isExternalIframeSource || !isPlaying || !onMasterMediaEvent) return;
    const timer = setInterval(() => {
      const t = videoRef.current?.currentTime;
      if (typeof t === "number" && Number.isFinite(t)) {
        onMasterMediaEvent("time", t);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [isExternalIframeSource, isPlaying, onMasterMediaEvent]);

  // Expose an imperative "wake mix media" trigger to parent.
  useEffect(() => {
    if (!mixReviveTriggerRef) return;

    const trigger = (mixVolume: number) => {
      const clampedVolume = Math.max(0, Math.min(100, mixVolume));

      if (isExternalIframeSource) {
        if (isYouTubeSource) {
          sendExternalCommand("unMute");
          sendExternalCommand("setVolume", [Math.round(clampedVolume)]);
          sendExternalCommand("playVideo");
        } else {
          sendExternalCommand("setVolume", [clampedVolume / 100]);
          sendExternalCommand("play");
        }
        return;
      }

      const el = videoRef.current;
      if (!el) return;
      void el.play().catch(() => {
        // ignore autoplay policy/transient errors
      });
    };

    mixReviveTriggerRef.current = trigger;
    return () => {
      if (mixReviveTriggerRef.current === trigger) {
        mixReviveTriggerRef.current = null;
      }
    };
  }, [mixReviveTriggerRef, isExternalIframeSource, isYouTubeSource, sendExternalCommand]);

  // Listen for YouTube iframe messages: ended state, current time, duration
  useEffect(() => {
    if (!isExternalIframeSource) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (isYouTubeSource) {
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
          return;
        }

        // Vimeo messages
        if (isVimeoSource) {
          if (data?.event === "ended") {
            onVideoEnded?.();
          }
          if (data?.event === "timeupdate") {
            const seconds = Number(data?.data?.seconds);
            const total = Number(data?.data?.duration);
            if (Number.isFinite(seconds) && Number.isFinite(total) && total > 0) {
              setDuration(total);
              setProgress(seconds / total);
            } else if (Number.isFinite(seconds) && duration > 0) {
              setProgress(seconds / duration);
            }
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onVideoEnded, duration, isExternalIframeSource, isYouTubeSource, isVimeoSource]);

  const handleSeek = useCallback((fraction: number) => {
    if (duration <= 0) return;
    const seekTime = fraction * duration;

    if (isExternalIframeSource) {
      if (isYouTubeSource) {
        sendExternalCommand("seekTo", [seekTime, true]);
      } else {
        sendExternalCommand("setCurrentTime", [seekTime]);
      }
    } else if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }

    setProgress(fraction);
  }, [duration, sendExternalCommand, isExternalIframeSource, isYouTubeSource]);

  const embedUrl = useMemo(() => {
    if (!videoUrl || !isExternalIframeSource) return "";
    if (isYouTubeSource) {
      const base = toYouTubeEmbedBaseUrl(videoUrl);
      if (!base) return "";
      const u = new URL(base);
      u.searchParams.set("enablejsapi", "1");
      u.searchParams.set("playsinline", "1");
      u.searchParams.set("origin", window.location.origin);
      u.searchParams.set("modestbranding", "1");
      u.searchParams.set("rel", "0");
      return u.toString();
    }

    // Vimeo embed
    const m = videoUrl.match(/(?:vimeo\.com\/(?:video\/)?)(\d+)/i);
    const id = m?.[1];
    if (!id) return "";
    const u = new URL(`https://player.vimeo.com/video/${id}`);
    u.searchParams.set("api", "1");
    u.searchParams.set("player_id", "studio-fader-vimeo");
    u.searchParams.set("autoplay", "0");
    u.searchParams.set("muted", "0");
    u.searchParams.set("playsinline", "1");
    return u.toString();
  }, [videoUrl, isExternalIframeSource, isYouTubeSource]);

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
            style={{
              opacity: hasActive ? screenOpacity : 0,
              filter: `brightness(${hasActive ? screenBrightness : 0})`,
              pointerEvents: hasActive ? "auto" : "none",
            }}
          >
            <div
              className="relative w-[78%] max-h-[85%] rounded-sm overflow-hidden"
              style={{
                aspectRatio: "16 / 9",
                background: "hsl(0 0% 0%)",
                boxShadow: "0 8px 40px hsl(0 0% 0% / 0.7), 0 2px 12px hsl(0 0% 0% / 0.5)",
              }}
            >
              {isExternalIframeSource ? (
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
                  ref={setVideoElement}
                  src={videoUrl}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                  playsInline
                  preload="metadata"
                  onPlay={(e) => onMasterMediaEvent?.("play", e.currentTarget.currentTime)}
                  onPause={(e) => onMasterMediaEvent?.("pause", e.currentTarget.currentTime)}
                  onSeeking={(e) => onMasterMediaEvent?.("seeking", e.currentTarget.currentTime)}
                  onSeeked={(e) => onMasterMediaEvent?.("seeked", e.currentTarget.currentTime)}
                  onWaiting={(e) => onMasterMediaEvent?.("waiting", e.currentTarget.currentTime)}
                  onCanPlay={(e) => onMasterMediaEvent?.("canplay", e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => {
                    const nextDuration = Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0;
                    setDuration(nextDuration);
                  }}
                  onTimeUpdate={(e) => {
                    const d = e.currentTarget.duration;
                    const t = e.currentTarget.currentTime;
                    onMasterMediaEvent?.("time", t);
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

        {!showVideo && showBlankWhenNoVideo && (
          <div className="absolute inset-0 z-[4] flex items-center justify-center pointer-events-none">
            <div
              className="relative w-[78%] max-h-[85%] rounded-sm"
              style={{
                aspectRatio: "16 / 9",
                background: "hsl(0 0% 0%)",
                opacity: hasActive ? screenOpacity : 0,
              }}
            />
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
