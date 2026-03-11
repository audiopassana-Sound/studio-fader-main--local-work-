import { useRef, useCallback, useMemo } from "react";

export interface AudioEngine {
  ensureAudio: () => void;
  setChannelUrl: (index: number, url?: string) => void;
  playAll: () => Promise<void>;
  pauseAll: () => void;
  stopAll: () => void;
  setChannelGain: (index: number, value: number, muted: boolean) => void;
  setChannelPan: (index: number, pan: number) => void;
  setMasterGain: (value: number) => void;
  applySoloState: (channels: { value: number; muted: boolean; soloed: boolean }[]) => void;
  getAnalyser: () => AnalyserNode | null;
}

const CHANNEL_COUNT = 5; // MIX + 4 stems

export function useAudioEngine(): AudioEngine {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainsRef = useRef<(GainNode | null)[]>([]);
  const pannersRef = useRef<(StereoPannerNode | null)[]>([]);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const mediaElsRef = useRef<(HTMLAudioElement | null)[]>(Array(CHANNEL_COUNT).fill(null));
  const mediaSourcesRef = useRef<(MediaElementAudioSourceNode | null)[]>(Array(CHANNEL_COUNT).fill(null));
  const pendingUrlsRef = useRef<(string | null)[]>(Array(CHANNEL_COUNT).fill(null));

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

    for (let i = 0; i < CHANNEL_COUNT; i++) {
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      gain.gain.value = 0;
      panner.pan.value = 0;
      gain.connect(panner);
      panner.connect(masterGain);
      gainsRef.current[i] = gain;
      pannersRef.current[i] = panner;

      const el = new Audio();
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      el.loop = true;

      const pending = pendingUrlsRef.current[i];
      if (pending) {
        el.src = pending;
        el.load();
      }

      mediaElsRef.current[i] = el;
      const src = ctx.createMediaElementSource(el);
      mediaSourcesRef.current[i] = src;
      src.connect(gain);
    }
  }, []);

  const setChannelUrl = useCallback((index: number, url?: string) => {
    if (index < 0 || index >= CHANNEL_COUNT) return;
    const next = url?.trim() || "";

    const el = mediaElsRef.current[index];
    if (!el) {
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
  }, []);

  const playAll = useCallback(async () => {
    ensureAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }

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

  const setChannelGain = useCallback((index: number, value: number, muted: boolean) => {
    if (index >= CHANNEL_COUNT || !gainsRef.current[index] || !audioCtxRef.current) return;
    const vol = muted ? 0 : (value / 100) * 0.3;
    gainsRef.current[index]!.gain.setTargetAtTime(vol, audioCtxRef.current.currentTime, 0.05);
  }, []);

  const setChannelPan = useCallback((index: number, pan: number) => {
    if (index >= CHANNEL_COUNT || !pannersRef.current[index] || !audioCtxRef.current) return;
    pannersRef.current[index]!.pan.setTargetAtTime(pan / 100, audioCtxRef.current.currentTime, 0.05);
  }, []);

  const setMasterGain = useCallback((value: number) => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    masterGainRef.current.gain.setTargetAtTime(value / 100, audioCtxRef.current.currentTime, 0.05);
  }, []);

  const applySoloState = useCallback((channels: { value: number; muted: boolean; soloed: boolean }[]) => {
    if (!audioCtxRef.current) return;
    const anySoloed = channels.some((ch) => ch.soloed);
    for (let i = 0; i < CHANNEL_COUNT; i++) {
      if (!gainsRef.current[i]) continue;
      const ch = channels[i];
      const shouldPlay = !ch.muted && (!anySoloed || ch.soloed);
      gainsRef.current[i]!.gain.setTargetAtTime(
        shouldPlay ? (ch.value / 100) * 0.3 : 0,
        audioCtxRef.current.currentTime,
        0.05
      );
    }
  }, []);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  return useMemo(
    () => ({
      ensureAudio,
      setChannelUrl,
      playAll,
      pauseAll,
      stopAll,
      setChannelGain,
      setChannelPan,
      setMasterGain,
      applySoloState,
      getAnalyser,
    }),
    [
      ensureAudio,
      setChannelUrl,
      playAll,
      pauseAll,
      stopAll,
      setChannelGain,
      setChannelPan,
      setMasterGain,
      applySoloState,
      getAnalyser,
    ]
  );
}
