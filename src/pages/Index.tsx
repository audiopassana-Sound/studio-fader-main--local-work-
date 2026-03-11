import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import ChannelStrip from "@/components/console/ChannelStrip";
import CinematicScreen from "@/components/console/CinematicScreen";
import AnalogToggle from "@/components/console/AnalogToggle";
import TransportControls from "@/components/console/TransportControls";
import RecordButton from "@/components/console/RecordButton";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useProjects } from "@/hooks/useProjects";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface ChannelState {
  name: string;
  value: number;
  userValue: number;
  muted: boolean;
  soloed: boolean;
  pan: number;
  showUpload?: boolean;
  isMaster?: boolean;
  color: string;
  motorized?: boolean;
}

const DEFAULT_VIDEO_URL = "https://www.youtube.com/watch?v=EeOsFxf2EZ8";

const getInitialChannels = (project?: {
  stem1Name?: string;
  stem2Name?: string;
  stem3Name?: string;
  stem4Name?: string;
}): ChannelState[] => [
  {
    name: "MIX",
    value: 0,
    userValue: 0,
    muted: false,
    soloed: false,
    pan: 0,
    color:
      "radial-gradient(ellipse at center, hsl(210 80% 25%) 0%, hsl(220 60% 10%) 100%)",
  },
  {
    name: project?.stem1Name || "STEM 1",
    value: 0,
    userValue: 0,
    muted: false,
    soloed: false,
    pan: 0,
    showUpload: true,
    color:
      "radial-gradient(ellipse at 30% 40%, hsl(0 70% 30%) 0%, hsl(350 50% 8%) 100%)",
  },
  {
    name: project?.stem2Name || "STEM 2",
    value: 0,
    userValue: 0,
    muted: false,
    soloed: false,
    pan: 0,
    showUpload: true,
    color:
      "radial-gradient(ellipse at 70% 30%, hsl(142 60% 25%) 0%, hsl(160 40% 6%) 100%)",
  },
  {
    name: project?.stem3Name || "STEM 3",
    value: 0,
    userValue: 0,
    muted: false,
    soloed: false,
    pan: 0,
    showUpload: true,
    color:
      "radial-gradient(ellipse at 50% 60%, hsl(38 80% 30%) 0%, hsl(30 60% 8%) 100%)",
  },
  {
    name: project?.stem4Name || "STEM 4",
    value: 0,
    userValue: 0,
    muted: false,
    soloed: false,
    pan: 0,
    showUpload: true,
    color:
      "radial-gradient(ellipse at 40% 50%, hsl(270 60% 30%) 0%, hsl(280 40% 8%) 100%)",
  },
  { name: "MASTER", value: 75, userValue: 75, muted: false, soloed: false, pan: 0, isMaster: true, color: "" },
];

const Index = () => {
  const projects = useProjects();
  const [channels, setChannels] = useState<ChannelState[]>(getInitialChannels(projects.currentProject));
  // Threshold where fader auto-starts playback: -9.5 dB on our scale.
  // ChannelStrip maps 0–100 → dB via: dB = (value / 100) * 12 - 12
  // Solving for -9.5 dB gives ≈ 20.8%
  const FADER_PLAY_THRESHOLD = 20.8;
  const audio = useAudioEngine();
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const motorizedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playFiredRef = useRef(false);
  const playPulseTriggerRef = useRef<(() => void) | null>(null);
  // Backwards-compat shim: avoid runtime crash if any stale JSX still references this identifier.
  const playPulseNonce = 0;

  // Ensure playback is stopped when leaving the studio route
  useEffect(() => {
    return () => {
      projects.stopPlay();
      audio.stopAll();
    };
  }, [projects.stopPlay, audio]);

  // Reset all faders and audio when category or project switches
  const prevCategory = useRef(projects.category);
  const prevProjectId = useRef(projects.currentProject?.id);
  useEffect(() => {
    if (prevCategory.current !== projects.category || prevProjectId.current !== projects.currentProject?.id) {
      prevCategory.current = projects.category;
      prevProjectId.current = projects.currentProject?.id;
      setChannels(getInitialChannels(projects.currentProject));
      setAnalyserNode(null);
      playFiredRef.current = false;
      projects.stopPlay();
      audio.stopAll();

      // Load audio sources for this project (MIX + 4 stems)
      audio.setChannelUrl(0, projects.currentProject?.audioMixUrl);
      audio.setChannelUrl(1, projects.currentProject?.stem1Url);
      audio.setChannelUrl(2, projects.currentProject?.stem2Url);
      audio.setChannelUrl(3, projects.currentProject?.stem3Url);
      audio.setChannelUrl(4, projects.currentProject?.stem4Url);

      for (let i = 0; i < 5; i++) audio.setChannelGain(i, 0, false);
      audio.setMasterGain(75);
    }
  }, [projects.category, projects.currentProject?.id, audio, projects.currentProject, projects.stopPlay]);


  // Find the first active (non-muted, value > 0) channel for M shortcut
  const activeChannelRef = useRef(0);
  useEffect(() => {
    const idx = channels.findIndex((ch, i) => i < 5 && ch.value > 0 && !ch.muted);
    activeChannelRef.current = idx >= 0 ? idx : 0;
  }, [channels]);

  // Animate VU meters based on fader values + playing state
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const isPlayingRef = useRef(projects.isPlaying);
  isPlayingRef.current = projects.isPlaying;

  const vuLevelsRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const vuSources = useMemo(
    () => Array.from({ length: 6 }, (_, i) => () => vuLevelsRef.current[i] ?? 0),
    []
  );

  useEffect(() => {
    let raf: number;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const chs = channelsRef.current;
      const playing = isPlayingRef.current;

      for (let i = 0; i < 6; i++) {
        const ch = chs[i];
        if (!ch) {
          vuLevelsRef.current[i] = 0;
          continue;
        }

        if (i === 5) {
          const maxCh = Math.max(...chs.slice(0, 5).map((c) => (c.muted ? 0 : c.value)));
          if (maxCh === 0 || !playing) {
            vuLevelsRef.current[i] = 0;
            continue;
          }
          const base = (maxCh / 100) * (ch.value / 100) * 100;
          vuLevelsRef.current[i] = Math.max(0, Math.min(100, base + (Math.random() * 12 - 6)));
          continue;
        }

        if (ch.muted || ch.value === 0 || !playing) {
          vuLevelsRef.current[i] = 0;
          continue;
        }

        vuLevelsRef.current[i] = Math.max(0, Math.min(100, ch.value + (Math.random() * 16 - 8)));
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ensureAnalyserOnce = useCallback(() => {
    audio.ensureAudio();
    if (!analyserNode) {
      const a = audio.getAnalyser();
      if (a) setAnalyserNode(a);
    }
  }, [audio, analyserNode]);

  // Single source of truth for starting/stopping playback.
  // The TransportControls Play button uses the toggle; fader auto-play uses handlePlay().
  const handlePlay = useCallback(() => {
    if (projects.isPlaying) return;
    ensureAnalyserOnce();
    void audio.playAll();
    projects.startPlay();
  }, [audio, ensureAnalyserOnce, projects.isPlaying, projects.startPlay]);

  const handlePause = useCallback(() => {
    if (!projects.isPlaying) return;
    audio.pauseAll();
    projects.stopPlay();
  }, [audio, projects.isPlaying, projects.stopPlay]);

  const handlePlayPause = useCallback(() => {
    if (projects.isPlaying) {
      handlePause();
      return;
    }
    handlePlay();
  }, [handlePause, handlePlay, projects.isPlaying]);

  const handleFaderChange = useCallback(
    (index: number, value: number) => {
      ensureAnalyserOnce();

      let shouldPlay = false;
      let shouldPause = false;
      let shouldPulse = false;

      setChannels((prev) => {
        const next = [...prev];
        const prevCh = next[index];
        if (!prevCh) return prev;

        const prevValue = prevCh.value;
        next[index] = { ...prevCh, value, userValue: value };

        // MIX fader logic: engaging MIX kills stems (motorized pull-down)
        if (index === 0 && value > 0) {
          const anyStemActive = prev.slice(1, 5).some((ch) => ch.value > 0 && !ch.muted);
          if (anyStemActive) {
            for (let i = 1; i <= 4; i++) {
              next[i] = { ...next[i], muted: true, motorized: true, value: 0, userValue: 0 };
              audio.setChannelGain(i, 0, true);
            }
            if (motorizedTimerRef.current) clearTimeout(motorizedTimerRef.current);
            motorizedTimerRef.current = setTimeout(() => {
              setChannels((p) => {
                const cleared = [...p];
                for (let i = 1; i <= 4; i++) cleared[i] = { ...cleared[i], motorized: false };
                return cleared;
              });
            }, 1600);
          }
        }

        // MIX at 0 releases stem mutes
        if (index === 0 && value === 0) {
          for (let i = 1; i <= 4; i++) {
            next[i] = { ...next[i], muted: false };
            audio.setChannelGain(i, next[i].value, false);
          }
        }

        // Fader-triggered playback: upward cross of the -9.5 dB (~20.8%) threshold
        if (index < 5 && prevValue < FADER_PLAY_THRESHOLD && value >= FADER_PLAY_THRESHOLD && !projects.isPlaying) {
          shouldPlay = true;
          shouldPulse = true;
          playFiredRef.current = true;
        }

        // Auto-pause: if this fader hit 0, check if ALL channels 0-4 are now at 0
        if (index < 5 && value === 0) {
          const allZero = next.slice(0, 5).every((ch) => ch.value === 0);
          if (allZero) {
            shouldPause = true;
            playFiredRef.current = false;
          }
        }

        // Audio sync: update only the channel that changed (and master when needed)
        if (index < 5) audio.setChannelGain(index, value, next[index].muted);
        if (index === 5) audio.setMasterGain(value);

        return next;
      });

      if (shouldPlay) {
        // Use the exact same play logic as the main Play button.
        handlePlay();
      }
      if (shouldPause) {
        // Use the exact same pause logic as the main Play button.
        handlePause();
      }
      if (shouldPulse) playPulseTriggerRef.current?.();
    },
    [ensureAnalyserOnce, handlePause, handlePlay]
  );


  const handleMuteToggle = useCallback(
    (index: number) => {
      setChannels((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], muted: !next[index].muted };
        if (index < 5) audio.setChannelGain(index, next[index].value, next[index].muted);
        return next;
      });
    },
    [audio]
  );

  const handleSoloToggle = useCallback(
    (index: number) => {
      setChannels((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], soloed: !next[index].soloed };
        audio.applySoloState(next.slice(0, 5));
        return next;
      });
    },
    [audio]
  );

  const handlePanChange = useCallback(
    (index: number, pan: number) => {
      ensureAnalyserOnce();
      setChannels((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], pan };
        if (index < 5) audio.setChannelPan(index, pan);
        return next;
      });
    },
    [audio, ensureAnalyserOnce]
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onNext: projects.goNext,
    onPrev: projects.goPrev,
    onMuteActive: useCallback(() => {
      handleMuteToggle(activeChannelRef.current);
    }, [handleMuteToggle]),
  });

  const anySoloed = channels.slice(0, 5).some((ch) => ch.soloed);
  const screenLayers = channels.slice(0, 5).map((ch) => {
    const shouldShow = !ch.muted && (!anySoloed || ch.soloed);
    return { label: ch.name, opacity: shouldShow ? ch.value / 100 : 0, color: ch.color };
  });

  // Master fader is audio-only; visuals always at full brightness
  const masterBrightness = 1;

  // YouTube volume: MIX fader (ch0) scaled by MASTER fader (ch5)
  const mixValue = channels[0].muted ? 0 : channels[0].value;
  const masterValue = channels[5].value;
  const computedVolume = (mixValue / 100) * (masterValue / 100) * 100;

  // Visualizer amplitude: max active fader level × master, 0 when paused
  const maxActiveFader = Math.max(...channels.slice(0, 5).map((ch) => (ch.muted ? 0 : ch.value)));
  const visualizerAmplitude = projects.isPlaying && maxActiveFader > 0 ? (maxActiveFader / 100) * (masterValue / 100) : 0;

  const handleBeforePortfolio = useCallback(() => {
    projects.stopPlay();
    audio.stopAll();
  }, [projects.stopPlay, audio]);


  const effectiveVideoUrl = projects.currentProject?.videoUrl || DEFAULT_VIDEO_URL;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden select-none">
      {/* Record button — top center (must always be clickable and above overlays) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[120] pointer-events-none">
        <RecordButton isPlaying={projects.isPlaying} onBeforeNavigate={handleBeforePortfolio} />
      </div>

      {/* Screen area */}
      <div className="flex-1 min-h-0 p-2 pb-0">
        <CinematicScreen
          layers={screenLayers}
          masterBrightness={masterBrightness}
          analyserNode={analyserNode}
          videoUrl={effectiveVideoUrl}
          isPlaying={projects.isPlaying}
          onVideoEnded={projects.stopPlay}
          volume={computedVolume}
          amplitude={visualizerAmplitude}
        />
      </div>

      {/* Divider with screws */}
      <div className="h-px bg-border mx-2 flex items-center justify-center relative">
        <div className="absolute flex gap-32">
          <div className="console-screw" />
          <div className="console-screw" />
          <div className="console-screw" />
        </div>
      </div>

      {/* Transport bar: Toggle + Transport + Project info */}
      <div className="w-full max-w-3xl mx-auto px-2">
        <div className="px-4 py-2 flex items-center justify-between gap-4 flex-wrap bg-transparent">
          <AnalogToggle value={projects.category} onChange={projects.switchCategory} />
          <TransportControls
            isPlaying={projects.isPlaying}
            pulseTriggerRef={playPulseTriggerRef}
            onPrev={projects.goPrev}
            onPlayPause={handlePlayPause}
            onNext={projects.goNext}
            projectLabel={
              projects.currentProject
                ? `${projects.currentIndex + 1}/${projects.projectCount}  ${projects.currentProject.name}`
                : undefined
            }
          />
        </div>
      </div>


      {/* Console strips */}
      <div className="console-surface px-3 py-2 mx-2 mb-2 rounded-b flex items-end justify-center gap-1 overflow-x-auto">
        {channels.map((ch, i) => (
          <ChannelStrip
            key={`${projects.currentProject?.id || "default"}-${i}`}
            name={ch.name}
            value={ch.value}
            isMuted={ch.muted}
            isSoloed={ch.soloed}
            pan={ch.pan}
            vuLevelSource={vuSources[i]}
            showUpload={ch.showUpload}
            isMaster={ch.isMaster}
            motorized={ch.motorized}
            onFaderChange={(v) => handleFaderChange(i, v)}
            onMuteToggle={() => handleMuteToggle(i)}
            onSoloToggle={() => handleSoloToggle(i)}
            onPanChange={(v) => handlePanChange(i, v)}
          />
        ))}
      </div>
    </div>
  );
};

export default Index;
