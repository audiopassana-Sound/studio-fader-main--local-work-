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

const getInitialChannels = (project?: { stems?: { name?: string; url: string }[] }): ChannelState[] => [
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
  ...((project?.stems || []).map((stem, stemIdx) => {
    const stemColors = [
      "radial-gradient(ellipse at 30% 40%, hsl(0 70% 30%) 0%, hsl(350 50% 8%) 100%)",
      "radial-gradient(ellipse at 70% 30%, hsl(142 60% 25%) 0%, hsl(160 40% 6%) 100%)",
      "radial-gradient(ellipse at 50% 60%, hsl(38 80% 30%) 0%, hsl(30 60% 8%) 100%)",
      "radial-gradient(ellipse at 40% 50%, hsl(270 60% 30%) 0%, hsl(280 40% 8%) 100%)",
    ];
    return {
      name: stem.name || `STEM ${stemIdx + 1}`,
      value: 0,
      userValue: 0,
      muted: false,
      soloed: false,
      pan: 0,
      showUpload: true,
      color: stemColors[stemIdx % stemColors.length],
    };
  }) as ChannelState[]),
  { name: "MASTER", value: 75, userValue: 75, muted: false, soloed: false, pan: 0, isMaster: true, color: "" },
];

const Index = () => {
  const projects = useProjects();
  const rawVideoUrl = projects.currentProject?.videoUrl?.trim() || "";
  const hasUploadedVideoFile = /\/storage\/v1\/object\/public\/video_files\//i.test(rawVideoUrl);
  const hasExternalVideoLink = !hasUploadedVideoFile && !!rawVideoUrl;
  const effectiveVideoUrl = hasUploadedVideoFile
    ? rawVideoUrl
    : hasExternalVideoLink
      ? rawVideoUrl
      : undefined;
  const hasMixAudioFile = !!projects.currentProject?.audioMixUrl;
  const mixUsesAudioFile = !effectiveVideoUrl && hasMixAudioFile;
  const isNativeVideoSource =
    !!effectiveVideoUrl &&
    !/youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com/i.test(effectiveVideoUrl);
  const mixUsesWebAudioChannel = mixUsesAudioFile || isNativeVideoSource;
  const [channels, setChannels] = useState<ChannelState[]>(getInitialChannels(projects.currentProject));
  // Derive indexes from current channel state (not project metadata) to avoid
  // transient mismatches during async project switches.
  const masterIndex = Math.max(1, channels.length - 1);
  const playableCount = Math.max(1, channels.length - 1); // mix + stems, excludes master
  const [activeAudioMode, setActiveAudioMode] = useState<"mix" | "stems" | "idle">("idle");
  // -8.0 dB on our 0..100 scale:
  // dB = (value/100)*12 - 12 => value = ((-8 + 12)/12)*100 = 33.333...
  const MIX_PLAY_BOOTSTRAP_VALUE = 33.333;
  const persistedMixRef = useRef(0);
  const persistedStemsByProjectRef = useRef<Record<string, number[]>>({});
  const persistedMasterRef = useRef(75);
  const audio = useAudioEngine();
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const playPulseTriggerRef = useRef<(() => void) | null>(null);
  const hadAudibleActivityRef = useRef(false);
  const manualPauseRef = useRef(false);
  const masterVideoReadyRef = useRef(!isNativeVideoSource);
  const pendingPlayRef = useRef(false);
  const handlePlayRef = useRef<(() => Promise<void>) | null>(null);
  const prevPlayableCountRef = useRef(playableCount);
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
      const baseChannels = getInitialChannels(projects.currentProject);
      const projectKey = projects.currentProject?.id || "__default__";
      const persistedStems = persistedStemsByProjectRef.current[projectKey] || [];
      const nextChannels = baseChannels.map((ch, i) => {
        if (i === 0) {
          return { ...ch, value: persistedMixRef.current, userValue: persistedMixRef.current };
        }
        if (i === baseChannels.length - 1) {
          return { ...ch, value: persistedMasterRef.current, userValue: persistedMasterRef.current };
        }
        const stemIdx = i - 1;
        const persistedStem = persistedStems[stemIdx] ?? 0;
        return { ...ch, value: persistedStem, userValue: persistedStem };
      });
      setChannels(nextChannels);
      setAnalyserNode(null);
      hadAudibleActivityRef.current = false;
      pendingPlayRef.current = false;
      masterVideoReadyRef.current = !isNativeVideoSource;
      projects.stopPlay();
      audio.stopAll();

      // Priority routing for MIX channel:
      // 1) Uploaded video file audio track
      // 2) External video link audio track
      // 3) Uploaded audio_mix_url
      // If a video source is present, MIX channel 0 audio file is disabled.
      audio.setChannelUrl(0, mixUsesAudioFile ? projects.currentProject?.audioMixUrl : undefined);
      (projects.currentProject?.stems || []).forEach((stem, idx) => {
        audio.setChannelUrl(idx + 1, stem.url);
      });
      // Clear any leftover channels from previous project with more stems.
      const prevCount = prevPlayableCountRef.current;
      const nextCount = (projects.currentProject?.stems?.length ?? 0) + 1;
      for (let i = nextCount; i < prevCount; i++) {
        audio.setChannelUrl(i, undefined);
      }
      prevPlayableCountRef.current = nextCount;

      // Keep master level persistent across project changes too.
      audio.setMasterGain(persistedMasterRef.current);
    }
  }, [
    projects.category,
    projects.currentProject?.id,
    projects.currentProject,
    projects.stopPlay,
    audio,
    isNativeVideoSource,
    mixUsesAudioFile,
  ]);

  // Persist MIX/MASTER globally, and stems per project to avoid cross-project index bleed.
  useEffect(() => {
    persistedMixRef.current = channels[0]?.value ?? 0;
    persistedMasterRef.current = channels[Math.max(1, channels.length - 1)]?.value ?? 75;
    const projectKey = projects.currentProject?.id || "__default__";
    persistedStemsByProjectRef.current[projectKey] = channels
      .slice(1, Math.max(1, channels.length - 1))
      .map((ch) => ch.value);
  }, [channels, projects.currentProject?.id]);

  const deriveAudioMode = useCallback((chs: ChannelState[]): "mix" | "stems" | "idle" => {
    const dynamicMasterIndex = Math.max(1, chs.length - 1);
    const stemVolumes = chs.slice(1, dynamicMasterIndex).map((ch) => ch.value);
    const anyStemRaised = stemVolumes.some((v) => v > 0);
    const mixRaised = (chs[0]?.value ?? 0) > 0;
    if (activeAudioMode === "mix" && mixRaised) return "mix";
    if (activeAudioMode === "stems" && anyStemRaised) return "stems";
    if (anyStemRaised) return "stems";
    if (mixRaised) return "mix";
    return "idle";
  }, [activeAudioMode]);

  useEffect(() => {
    const nextMode = deriveAudioMode(channels);
    if (activeAudioMode !== nextMode) setActiveAudioMode(nextMode);
  }, [channels, activeAudioMode, deriveAudioMode]);

  // Find the first active (non-muted, value > 0) channel for M shortcut
  const activeChannelRef = useRef(0);
  useEffect(() => {
    const idx = channels.findIndex((ch, i) => i < masterIndex && ch.value > 0 && !ch.muted);
    activeChannelRef.current = idx >= 0 ? idx : 0;
  }, [channels, masterIndex]);

  // Animate VU meters based on fader values + playing state
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const isPlayingRef = useRef(projects.isPlaying);
  isPlayingRef.current = projects.isPlaying;

  const vuLevelsRef = useRef<number[]>(Array.from({ length: channels.length }, () => 0));
  const vuSources = useMemo(
    () => Array.from({ length: channels.length }, (_, i) => () => vuLevelsRef.current[i] ?? 0),
    [channels.length]
  );

  useEffect(() => {
    let raf: number;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const chs = channelsRef.current;
      const playing = isPlayingRef.current;

      for (let i = 0; i < channelsRef.current.length; i++) {
        const ch = chs[i];
        if (!ch) {
          vuLevelsRef.current[i] = 0;
          continue;
        }

        if (i === masterIndex) {
          const maxCh = Math.max(0, ...chs.slice(0, masterIndex).map((c) => (c.muted ? 0 : c.value)));
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
  }, [masterIndex, channels.length]);

  const ensureAnalyserOnce = useCallback(() => {
    audio.ensureAudio();
    void audio.resumeAudio();
    if (!analyserNode) {
      const a = audio.getAnalyser();
      if (a) setAnalyserNode(a);
    }
  }, [audio, analyserNode]);

  const handleMixMediaElementChange = useCallback(
    (element: HTMLMediaElement | null) => {
      if (isNativeVideoSource && element) {
        audio.bindChannelMediaElement(0, element);
        return;
      }
      audio.bindChannelMediaElement(0, null);
    },
    [audio, isNativeVideoSource]
  );

  const getPlaybackModeFromLevels = useCallback((chs: ChannelState[]): "mix" | "stems" | "idle" => {
    return deriveAudioMode(chs);
  }, [deriveAudioMode]);

  // Single source of truth for starting/stopping playback.
  // The TransportControls Play button uses the toggle; fader auto-play uses handlePlay().
  const handlePlay = useCallback(async (forcedMode?: "mix" | "stems", forcedActiveAudioIndices?: number[], forceStart = false) => {
    if (projects.isPlaying && !forceStart) return;
    ensureAnalyserOnce();
    await audio.resumeAudio();
    const mode = forcedMode ?? getPlaybackModeFromLevels(channelsRef.current);
    if (mode === "idle") return;
    manualPauseRef.current = false;
    setActiveAudioMode(mode);

    const activeAudioIndices =
      forcedActiveAudioIndices ??
      channelsRef.current
        .slice(0, masterIndex)
        .map((ch, i) => ({ ch, i }))
        .filter(({ ch, i }) => {
          if (mode === "mix") return i === 0 && ch.value > 0;
          return i >= 1 && i < masterIndex && ch.value > 0;
        })
        .map(({ i }) => i);
    await audio.waitForReady(activeAudioIndices);
    if (isNativeVideoSource && !masterVideoReadyRef.current) {
      pendingPlayRef.current = true;
      return;
    }
    await audio.playAll();
    projects.startPlay();
  }, [audio, ensureAnalyserOnce, getPlaybackModeFromLevels, isNativeVideoSource, projects.isPlaying, projects.startPlay, masterIndex]);

  const handlePause = useCallback(() => {
    if (!projects.isPlaying) return;
    manualPauseRef.current = true;
    audio.pauseAll();
    projects.stopPlay();
  }, [audio, projects.isPlaying, projects.stopPlay]);

  const handlePlayPause = useCallback(() => {
    void audio.resumeAudio();
    const mediaActuallyPlaying = audio.isAnyMediaPlaying();
    if (projects.isPlaying && mediaActuallyPlaying) {
      handlePause();
      return;
    }
    const mixRaised = channelsRef.current[0]?.value > 0;
    const anyStemRaised = channelsRef.current.slice(1, masterIndex).some((ch) => ch.value > 0);

    // If all faders are down, bootstrap MIX to -8.0 dB so play is audible/visible immediately.
    if (!mixRaised && !anyStemRaised) {
      setChannels((prev) => {
        const next = [...prev];
        next[0] = {
          ...next[0],
          muted: false,
          value: MIX_PLAY_BOOTSTRAP_VALUE,
          userValue: MIX_PLAY_BOOTSTRAP_VALUE,
        };
        return next;
      });
      setActiveAudioMode("mix");
      void handlePlay("mix", [0], true);
      return;
    }

    // Explicit Play should honor current fader levels and force underlying media play
    // even if React state drifted.
    void handlePlay(undefined, undefined, true);
  }, [audio, handlePause, handlePlay, projects.isPlaying, masterIndex]);

  useEffect(() => {
    handlePlayRef.current = handlePlay;
  }, [handlePlay]);

  const handleMasterMediaEvent = useCallback(
    (event: "play" | "pause" | "seeking" | "seeked" | "waiting" | "canplay" | "time", currentTime: number) => {
      if (!isNativeVideoSource) return;

      if (event === "canplay") {
        masterVideoReadyRef.current = true;
        if (pendingPlayRef.current && !isPlayingRef.current) {
          pendingPlayRef.current = false;
          void handlePlayRef.current?.();
        }
        return;
      }

      if (event === "time") {
        if (isPlayingRef.current) audio.correctDrift(currentTime, 0.15);
        return;
      }

      audio.mirrorMasterEvent(event, currentTime);
    },
    [audio, isNativeVideoSource]
  );

  const handleFaderChange = useCallback(
    (index: number, value: number) => {
      ensureAnalyserOnce();
      if (index < masterIndex && value > 0) {
        // User touch on audible faders should re-enable auto-play behavior.
        manualPauseRef.current = false;
      }

      setChannels((prev) => {
        const next = [...prev];
        const prevCh = next[index];
        if (!prevCh) return prev;

        next[index] = { ...prevCh, value, userValue: value };

        // Engaging MIX should mute stems for audio routing without moving their sliders.
        if (index === 0 && value > 0) {
          const anyStemActive = prev.slice(1, masterIndex).some((ch) => ch.value > 0);
          if (anyStemActive) {
            for (let i = 1; i < masterIndex; i++) {
              next[i] = { ...next[i], muted: true, motorized: false };
            }
          }
          next[0] = { ...next[0], muted: false, motorized: false };
          setActiveAudioMode("mix");
        }

        // Reverse A/B visuals: engaging ANY stem mutes MIX, but must not
        // change MIX numeric value. This preserves the user's exact MIX fader state.
        if (index >= 1 && index < masterIndex && value > 0) {
          const mixIsActive = (prev[0]?.value ?? 0) > 0;
          if (mixIsActive) {
            next[0] = { ...next[0], muted: true, motorized: false };
          }
          for (let i = 1; i < masterIndex; i++) {
            next[i] = { ...next[i], muted: false, motorized: false };
          }
          setActiveAudioMode("stems");
        }

        // MIX at 0 releases stem mutes visually.
        if (index === 0 && value === 0) {
          for (let i = 1; i < masterIndex; i++) {
            next[i] = { ...next[i], muted: false };
          }
          const anyStemActive = next.slice(1, masterIndex).some((ch) => ch.value > 0);
          setActiveAudioMode(anyStemActive ? "stems" : "idle");
        }

        // If all stems are intentionally lowered to 0, return to MIX mode.
        // Do not modify MIX numeric value here.
        if (index >= 1 && index < masterIndex) {
          const stemVolumes = next.slice(1, masterIndex).map((ch) => ch.value);
          const allStemsZero = stemVolumes.every((v) => v === 0);
          if (allStemsZero) {
            next[0] = {
              ...next[0],
              muted: false,
              motorized: false,
            };
            setActiveAudioMode((next[0]?.value ?? 0) > 0 ? "mix" : "idle");
          }
        }

        return next;
      });
    },
    [ensureAnalyserOnce, masterIndex]
  );

  // Centralized media-control state machine (A/B exclusivity + transport).
  useEffect(() => {
    const mixLevel = channels[0]?.value ?? 0;
    const stems = channels.slice(1, masterIndex);
    const master = channels[masterIndex]?.value ?? 75;
    const anyStemRaised = stems.some((ch) => ch.value > 0);
    const anySoloed = stems.some((ch) => ch.soloed);
    const mode = deriveAudioMode(channels);

    // Rule 1: Exclusive A/B Audio State
    if (mode === "stems") {
      // Mix hard mute
      audio.setChannelGain(0, 0, true);

      // Active stems unmute (respect solo routing)
      stems.forEach((ch, i) => {
        const shouldAudible = ch.value > 0 && (!anySoloed || ch.soloed);
        audio.setChannelGain(i + 1, shouldAudible ? ch.value : 0, !shouldAudible);
      });
    } else if (mode === "mix") {
      // Mix active path
      if (mixUsesWebAudioChannel) {
        audio.setChannelGain(0, mixLevel, false);
      } else {
        // For video/external mix sources, channel 0 HTMLAudio should stay silent.
        audio.setChannelGain(0, 0, true);
      }

      // All stems hard mute
      for (let i = 1; i < masterIndex; i++) {
        audio.setChannelGain(i, 0, true);
      }
    } else {
      // Idle: hard mute all mix/stem audio channels
      for (let i = 0; i < masterIndex; i++) {
        audio.setChannelGain(i, 0, true);
      }
    }

    // Master gain always follows master fader.
    audio.setMasterGain(master);

    // Rule 2: Unified Video Playback
    const shouldPlay = mode !== "idle";
    if (shouldPlay && !projects.isPlaying && !manualPauseRef.current) {
      void handlePlay();
      if (!hadAudibleActivityRef.current) {
        playPulseTriggerRef.current?.();
      }
      hadAudibleActivityRef.current = true;
    } else if (!shouldPlay && projects.isPlaying) {
      handlePause();
      hadAudibleActivityRef.current = false;
      manualPauseRef.current = false;
    }
  }, [channels, deriveAudioMode, audio, mixUsesWebAudioChannel, projects.isPlaying, handlePlay, handlePause, masterIndex]);


  const handleMuteToggle = useCallback(
    (index: number) => {
      setChannels((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], muted: !next[index].muted };
        if (index < masterIndex) audio.setChannelGain(index, next[index].value, next[index].muted);
        return next;
      });
    },
    [audio, masterIndex]
  );

  const handleSoloToggle = useCallback(
    (index: number) => {
      setChannels((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], soloed: !next[index].soloed };
        audio.applySoloState(next.slice(0, masterIndex));
        return next;
      });
    },
    [audio, masterIndex]
  );

  const handlePanChange = useCallback(
    (index: number, pan: number) => {
      ensureAnalyserOnce();
      setChannels((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], pan };
        if (index < masterIndex) audio.setChannelPan(index, pan);
        return next;
      });
    },
    [audio, ensureAnalyserOnce, masterIndex]
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

  const anySoloed = channels.slice(0, masterIndex).some((ch) => ch.soloed);
  const stemVolumes = channels.slice(1, masterIndex).map((ch) => ch.value);
  const anyStemRaised = stemVolumes.some((v) => v > 0);
  const screenLayers = channels.slice(0, masterIndex).map((ch, i) => {
    if (i === 0) {
      const mixVisualValue = activeAudioMode === "stems" && anyStemRaised ? 100 : ch.value;
      return { label: ch.name, opacity: mixVisualValue / 100, color: ch.color };
    }
    const shouldShow = !ch.muted && (!anySoloed || ch.soloed) && ch.value > 0;
    return { label: ch.name, opacity: shouldShow ? ch.value / 100 : 0, color: ch.color };
  });

  // Master fader is audio-only; visuals always at full brightness
  const masterBrightness = 1;

  // Mix media volume follows declarative mode.
  const mixValue = activeAudioMode === "stems" ? 0 : (channels[0]?.value ?? 0);
  const masterValue = channels[masterIndex]?.value ?? 75;
  const computedVolume = (mixValue / 100) * (masterValue / 100) * 100;

  // Visualizer amplitude: max active fader level × master, 0 when paused
  const maxActiveFader = Math.max(0, ...channels.slice(0, masterIndex).map((ch) => (ch.muted ? 0 : ch.value)));
  const visualizerAmplitude = projects.isPlaying && maxActiveFader > 0 ? (maxActiveFader / 100) * (masterValue / 100) : 0;

  const handleBeforePortfolio = useCallback(() => {
    projects.stopPlay();
    audio.stopAll();
  }, [projects.stopPlay, audio]);

  const handleVideoEnded = useCallback(() => {
    projects.stopPlay();
    audio.stopAll();
  }, [projects.stopPlay, audio]);

  // Do not fall back to any hardcoded media URL; only use project URLs from Supabase.
  if (channels.length < 2) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

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
          showBlankWhenNoVideo={mixUsesAudioFile}
          isPlaying={projects.isPlaying}
          onVideoEnded={handleVideoEnded}
          onMasterMediaEvent={handleMasterMediaEvent}
          onMixMediaElementChange={handleMixMediaElementChange}
          mixMuted={activeAudioMode === "stems"}
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
