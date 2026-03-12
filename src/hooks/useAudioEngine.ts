import { useRef, useCallback, useMemo } from "react";

export interface AudioEngine {
  ensureAudio: () => void;
  resumeAudio: () => Promise<void>;
  setChannelUrl: (index: number, url?: string) => void;
  bindChannelMediaElement: (index: number, element: HTMLMediaElement | null) => void;
  playAll: () => Promise<void>;
  pauseAll: () => void;
  stopAll: () => void;
  reviveChannel: (index: number, value: number) => Promise<void>;
  mirrorMasterEvent: (event: "play" | "pause" | "seeking" | "seeked" | "waiting", masterTime: number) => void;
  correctDrift: (masterTime: number, maxDriftSec?: number) => void;
  waitForReady: (activeIndices: number[], timeoutMs?: number) => Promise<void>;
  setChannelGain: (index: number, value: number, muted: boolean) => void;
  setChannelPan: (index: number, pan: number) => void;
  setMasterGain: (value: number) => void;
  applySoloState: (channels: { value: number; muted: boolean; soloed: boolean }[]) => void;
  getAnalyser: () => AnalyserNode | null;
}

export function useAudioEngine(): AudioEngine {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainsRef = useRef<(GainNode | null)[]>([]);
  const pannersRef = useRef<(StereoPannerNode | null)[]>([]);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const mediaElsRef = useRef<(HTMLMediaElement | null)[]>([]);
  const mediaSourcesRef = useRef<(MediaElementAudioSourceNode | null)[]>([]);
  const pendingUrlsRef = useRef<(string | null)[]>([]);
  const externalBoundRef = useRef<boolean[]>([]);
  const mediaSourceCacheRef = useRef<WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>>(new WeakMap());

  const ensureGainChain = useCallback((index: number) => {
    const ctx = audioCtxRef.current;
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain || index < 0) return;
    if (gainsRef.current[index] && pannersRef.current[index]) return;

    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    gain.gain.value = 0;
    panner.pan.value = 0;
    gain.connect(panner);
    panner.connect(masterGain);
    gainsRef.current[index] = gain;
    pannersRef.current[index] = panner;
  }, []);

  const attachMediaElement = useCallback((index: number, el: HTMLMediaElement) => {
    const ctx = audioCtxRef.current;
    const gain = gainsRef.current[index];
    if (!ctx || !gain || index < 0) return;

    const prevSource = mediaSourcesRef.current[index];
    if (prevSource) {
      try {
        prevSource.disconnect(gain);
      } catch {
        // ignore disconnect errors from stale graph edges
      }
    }

    let source = mediaSourceCacheRef.current.get(el);
    if (!source) {
      source = ctx.createMediaElementSource(el);
      mediaSourceCacheRef.current.set(el, source);
    }

    try {
      source.connect(gain);
    } catch {
      // ignore duplicate edge errors
    }

    mediaElsRef.current[index] = el;
    mediaSourcesRef.current[index] = source;
  }, []);

  const ensureChannel = useCallback((index: number) => {
    const ctx = audioCtxRef.current;
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain || index < 0) return;
    ensureGainChain(index);
    if (mediaElsRef.current[index]) return;

    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.loop = true;
    const pending = pendingUrlsRef.current[index];
    if (pending) {
      el.src = pending;
      el.load();
    }
    attachMediaElement(index, el);
    externalBoundRef.current[index] = false;
  }, [attachMediaElement, ensureGainChain]);

  const ensureAudio = useCallback(() => {
    if (audioCtxRef.current) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.75;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // Channels are created lazily as soon as a URL/gain/pan is assigned.
  }, []);

  const resumeAudio = useCallback(async () => {
    ensureAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "suspended") return;
    try {
      await ctx.resume();
    } catch {
      // ignore resume rejection when not in user gesture
    }
  }, [ensureAudio]);

  const bindChannelMediaElement = useCallback(
    (index: number, element: HTMLMediaElement | null) => {
      if (index < 0) return;
      ensureAudio();
      ensureGainChain(index);
      const gain = gainsRef.current[index];
      const prevSource = mediaSourcesRef.current[index];

      if (!element) {
        if (prevSource && gain) {
          try {
            prevSource.disconnect(gain);
          } catch {
            // ignore stale disconnect errors
          }
        }
        // Drop external binding and fall back to internal Audio element.
        externalBoundRef.current[index] = false;
        mediaElsRef.current[index] = null;
        mediaSourcesRef.current[index] = null;
        ensureChannel(index);
        return;
      }

      // Prefer processed audio path; prevent relying on element.volume controls.
      element.crossOrigin = "anonymous";
      element.muted = false;
      element.volume = 1;
      externalBoundRef.current[index] = true;
      attachMediaElement(index, element);
    },
    [attachMediaElement, ensureAudio, ensureChannel, ensureGainChain]
  );

  const setChannelUrl = useCallback((index: number, url?: string) => {
    if (index < 0) return;
    const next = url?.trim() || "";

    ensureAudio();
    ensureChannel(index);
    const el = mediaElsRef.current[index];
    if (!el) {
      pendingUrlsRef.current[index] = next || null;
      return;
    }
    if (externalBoundRef.current[index]) {
      // Do not mutate src on externally-bound media elements (e.g. native video mix).
      pendingUrlsRef.current[index] = next || null;
      return;
    }

    if (next === "") {
      el.pause();
      el.removeAttribute("src");
      el.load();
      return;
    }

    // Avoid reloading the same URL
    if (el.src === next) return;

    el.src = next;
    el.load();
  }, [ensureAudio, ensureChannel]);

  const playAll = useCallback(async () => {
    ensureAudio();
    await resumeAudio();

    await Promise.all(
      mediaElsRef.current.map(async (el) => {
        if (!el || !el.src) return;
        try {
          await el.play();
        } catch {
          // ignore autoplay policy errors; user gesture will re-trigger
        }
      })
    );
  }, [ensureAudio]);

  const pauseAll = useCallback(() => {
    mediaElsRef.current.forEach((el) => el?.pause());
  }, []);

  const stopAll = useCallback(() => {
    mediaElsRef.current.forEach((el) => {
      if (!el) return;
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
    });
  }, []);

  const reviveChannel = useCallback(
    async (index: number, value: number) => {
      ensureAudio();
      await resumeAudio();

      const el = mediaElsRef.current[index];
      if (!el || !el.src) return;

      try {
        await el.play();
      } catch {
        // ignore policy/transient errors
      }
    },
    [ensureAudio, resumeAudio]
  );

  const mirrorMasterEvent = useCallback(
    (event: "play" | "pause" | "seeking" | "seeked" | "waiting", masterTime: number) => {
      mediaElsRef.current.forEach((el) => {
        if (!el || !el.src) return;

        // Keep timeline locked to master timekeeper (native video).
        if (Math.abs(el.currentTime - masterTime) > 0.01) {
          try {
            el.currentTime = masterTime;
          } catch {
            // ignore seek errors during transient states
          }
        }

        if (event === "play") {
          void el.play().catch(() => {
            // ignore; gesture/resume loop will retry
          });
        } else {
          // pause, seeking, seeked, waiting -> hold audio until master advances/plays
          el.pause();
        }
      });
    },
    []
  );

  const correctDrift = useCallback((masterTime: number, maxDriftSec = 0.15) => {
    mediaElsRef.current.forEach((el) => {
      if (!el || !el.src) return;
      if (Math.abs(el.currentTime - masterTime) > maxDriftSec) {
        try {
          el.currentTime = masterTime;
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const waitForReady = useCallback(async (activeIndices: number[], timeoutMs = 5000) => {
    const indices = activeIndices.filter((i) => i >= 0);
    if (indices.length === 0) return;

    const waiters = indices.map(
      (i) =>
        new Promise<void>((resolve) => {
          const el = mediaElsRef.current[i];
          if (!el || !el.src) {
            resolve();
            return;
          }

          // HAVE_FUTURE_DATA is enough to start without immediate stutter.
          if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
            resolve();
            return;
          }

          let done = false;
          const cleanup = () => {
            el.removeEventListener("canplay", onReady);
            el.removeEventListener("canplaythrough", onReady);
            el.removeEventListener("loadeddata", onReady);
          };
          const onReady = () => {
            if (done) return;
            done = true;
            cleanup();
            resolve();
          };

          el.addEventListener("canplay", onReady);
          el.addEventListener("canplaythrough", onReady);
          el.addEventListener("loadeddata", onReady);

          setTimeout(() => {
            if (done) return;
            done = true;
            cleanup();
            resolve();
          }, timeoutMs);
        })
    );

    await Promise.all(waiters);
  }, []);

  const setChannelGain = useCallback((index: number, value: number, muted: boolean) => {
    if (index < 0) return;
    ensureAudio();
    ensureChannel(index);
    if (!gainsRef.current[index] || !audioCtxRef.current) return;
    const vol = muted ? 0 : (value / 100) * 0.3;
    gainsRef.current[index]!.gain.setTargetAtTime(vol, audioCtxRef.current.currentTime, 0.05);
  }, [ensureAudio, ensureChannel]);

  const setChannelPan = useCallback((index: number, pan: number) => {
    if (index < 0) return;
    ensureAudio();
    ensureChannel(index);
    if (!pannersRef.current[index] || !audioCtxRef.current) return;
    pannersRef.current[index]!.pan.setTargetAtTime(pan / 100, audioCtxRef.current.currentTime, 0.05);
  }, [ensureAudio, ensureChannel]);

  const setMasterGain = useCallback((value: number) => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    masterGainRef.current.gain.setTargetAtTime(value / 100, audioCtxRef.current.currentTime, 0.05);
  }, []);

  const applySoloState = useCallback((channels: { value: number; muted: boolean; soloed: boolean }[]) => {
    if (!audioCtxRef.current) return;
    const anySoloed = channels.some((ch) => ch.soloed);
    for (let i = 0; i < channels.length; i++) {
      ensureChannel(i);
      if (!gainsRef.current[i]) continue;
      const ch = channels[i];
      const shouldPlay = !ch.muted && (!anySoloed || ch.soloed);
      gainsRef.current[i]!.gain.setTargetAtTime(
        shouldPlay ? (ch.value / 100) * 0.3 : 0,
        audioCtxRef.current.currentTime,
        0.05
      );
    }
  }, [ensureChannel]);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  return useMemo(
    () => ({
      ensureAudio,
      resumeAudio,
      setChannelUrl,
      bindChannelMediaElement,
      playAll,
      pauseAll,
      stopAll,
      reviveChannel,
      mirrorMasterEvent,
      correctDrift,
      waitForReady,
      setChannelGain,
      setChannelPan,
      setMasterGain,
      applySoloState,
      getAnalyser,
    }),
    [
      ensureAudio,
      resumeAudio,
      setChannelUrl,
      bindChannelMediaElement,
      playAll,
      pauseAll,
      stopAll,
      reviveChannel,
      mirrorMasterEvent,
      correctDrift,
      waitForReady,
      setChannelGain,
      setChannelPan,
      setMasterGain,
      applySoloState,
      getAnalyser,
    ]
  );
}
