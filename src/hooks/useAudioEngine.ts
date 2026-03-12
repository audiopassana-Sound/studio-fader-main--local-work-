import { useEffect } from "react";

export interface AudioEngine {
  ensureAudio: () => void;
  resumeAudio: () => Promise<void>;
  isAnyMediaPlaying: () => boolean;
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

let sharedAudioCtx: AudioContext | null = null;
let sharedMasterGain: GainNode | null = null;
let sharedAnalyser: AnalyserNode | null = null;
let sharedGains: (GainNode | null)[] = [];
let sharedPanners: (StereoPannerNode | null)[] = [];
let sharedMediaEls: (HTMLMediaElement | null)[] = [];
let sharedMediaSources: (MediaElementAudioSourceNode | null)[] = [];
let sharedPendingUrls: (string | null)[] = [];
let sharedExternalBound: boolean[] = [];
let sharedMediaSourceCache: WeakMap<HTMLMediaElement, MediaElementAudioSourceNode> = new WeakMap();
let engineConsumers = 0;

function ensureAudioGraph() {
  if (sharedAudioCtx) return;
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.75;
  masterGain.connect(analyser);
  analyser.connect(ctx.destination);

  sharedAudioCtx = ctx;
  sharedAnalyser = analyser;
  sharedMasterGain = masterGain;
}

function ensureGainChain(index: number) {
  if (index < 0 || !sharedAudioCtx || !sharedMasterGain) return;
  if (sharedGains[index] && sharedPanners[index]) return;

  const gain = sharedAudioCtx.createGain();
  const panner = sharedAudioCtx.createStereoPanner();
  gain.gain.value = 0;
  panner.pan.value = 0;
  gain.connect(panner);
  panner.connect(sharedMasterGain);
  sharedGains[index] = gain;
  sharedPanners[index] = panner;
}

function attachMediaElement(index: number, el: HTMLMediaElement) {
  if (index < 0 || !sharedAudioCtx) return;
  ensureGainChain(index);
  const gain = sharedGains[index];
  if (!gain) return;

  // Critical guard: the same HTMLMediaElement must map to one source node only.
  let source = sharedMediaSourceCache.get(el);
  if (!source) {
    source = sharedAudioCtx.createMediaElementSource(el);
    sharedMediaSourceCache.set(el, source);
  }

  const prevSource = sharedMediaSources[index];
  const alreadyBound = sharedMediaEls[index] === el && prevSource === source;
  if (alreadyBound) return;

  if (prevSource) {
    try {
      prevSource.disconnect(gain);
    } catch {
      // ignore stale disconnect errors
    }
  }

  try {
    source.connect(gain);
  } catch {
    // ignore duplicate edge errors
  }

  sharedMediaEls[index] = el;
  sharedMediaSources[index] = source;
}

function ensureChannel(index: number) {
  if (index < 0 || !sharedAudioCtx || !sharedMasterGain) return;
  ensureGainChain(index);
  if (sharedMediaEls[index]) return;

  const el = new Audio();
  el.crossOrigin = "anonymous";
  el.preload = "auto";
  el.loop = true;
  const pending = sharedPendingUrls[index];
  if (pending) {
    el.src = pending;
    el.load();
  }
  attachMediaElement(index, el);
  sharedExternalBound[index] = false;
}

async function resumeSharedAudio() {
  ensureAudioGraph();
  if (!sharedAudioCtx || sharedAudioCtx.state !== "suspended") return;
  try {
    await sharedAudioCtx.resume();
  } catch {
    // ignore resume rejection when not in user gesture
  }
}

async function suspendSharedAudio() {
  if (!sharedAudioCtx) return;

  sharedMediaEls.forEach((el) => {
    if (!el) return;
    el.pause();
  });

  try {
    if (sharedAudioCtx.state === "running") {
      await sharedAudioCtx.suspend();
    }
  } catch {
    // ignore suspend errors
  }
}

const sharedEngine: AudioEngine = {
  ensureAudio: () => {
    ensureAudioGraph();
  },
  resumeAudio: async () => {
    await resumeSharedAudio();
  },
  isAnyMediaPlaying: () =>
    sharedMediaEls.some((el) => !!el && !!el.src && !el.paused && !el.ended),
  setChannelUrl: (index: number, url?: string) => {
    if (index < 0) return;
    const next = url?.trim() || "";

    ensureAudioGraph();
    ensureChannel(index);
    const el = sharedMediaEls[index];
    if (!el) {
      sharedPendingUrls[index] = next || null;
      return;
    }

    if (sharedExternalBound[index]) {
      // Do not mutate src on externally-bound media elements (e.g. native video mix).
      sharedPendingUrls[index] = next || null;
      return;
    }

    if (next === "") {
      el.pause();
      el.removeAttribute("src");
      el.load();
      return;
    }

    if (el.src === next) return;
    el.src = next;
    el.load();
  },
  bindChannelMediaElement: (index: number, element: HTMLMediaElement | null) => {
    if (index < 0) return;
    ensureAudioGraph();
    ensureGainChain(index);
    const gain = sharedGains[index];
    const prevSource = sharedMediaSources[index];

    if (!element) {
      if (prevSource && gain) {
        try {
          prevSource.disconnect(gain);
        } catch {
          // ignore stale disconnect errors
        }
      }
      sharedExternalBound[index] = false;
      sharedMediaEls[index] = null;
      sharedMediaSources[index] = null;
      ensureChannel(index);
      return;
    }

    element.crossOrigin = "anonymous";
    element.muted = false;
    element.volume = 1;
    sharedExternalBound[index] = true;
    attachMediaElement(index, element);
  },
  playAll: async () => {
    ensureAudioGraph();
    await resumeSharedAudio();

    await Promise.all(
      sharedMediaEls.map(async (el) => {
        if (!el || !el.src) return;
        try {
          await el.play();
        } catch {
          // ignore autoplay policy errors; user gesture will re-trigger
        }
      })
    );
  },
  pauseAll: () => {
    sharedMediaEls.forEach((el) => el?.pause());
  },
  stopAll: () => {
    sharedMediaEls.forEach((el) => {
      if (!el) return;
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
    });
  },
  reviveChannel: async (index: number) => {
    ensureAudioGraph();
    await resumeSharedAudio();
    const el = sharedMediaEls[index];
    if (!el || !el.src) return;
    try {
      await el.play();
    } catch {
      // ignore policy/transient errors
    }
  },
  mirrorMasterEvent: (event, masterTime) => {
    sharedMediaEls.forEach((el) => {
      if (!el || !el.src) return;
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
        el.pause();
      }
    });
  },
  correctDrift: (masterTime, maxDriftSec = 0.15) => {
    sharedMediaEls.forEach((el) => {
      if (!el || !el.src) return;
      if (Math.abs(el.currentTime - masterTime) > maxDriftSec) {
        try {
          el.currentTime = masterTime;
        } catch {
          // ignore
        }
      }
    });
  },
  waitForReady: async (activeIndices, timeoutMs = 5000) => {
    const indices = activeIndices.filter((i) => i >= 0);
    if (indices.length === 0) return;

    const waiters = indices.map(
      (i) =>
        new Promise<void>((resolve) => {
          const el = sharedMediaEls[i];
          if (!el || !el.src) {
            resolve();
            return;
          }

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
  },
  setChannelGain: (index, value, muted) => {
    if (index < 0) return;
    ensureAudioGraph();
    ensureChannel(index);
    if (!sharedGains[index] || !sharedAudioCtx) return;
    const vol = muted ? 0 : (value / 100) * 0.3;
    sharedGains[index]!.gain.setTargetAtTime(vol, sharedAudioCtx.currentTime, 0.05);
  },
  setChannelPan: (index, pan) => {
    if (index < 0) return;
    ensureAudioGraph();
    ensureChannel(index);
    if (!sharedPanners[index] || !sharedAudioCtx) return;
    sharedPanners[index]!.pan.setTargetAtTime(pan / 100, sharedAudioCtx.currentTime, 0.05);
  },
  setMasterGain: (value) => {
    if (!sharedMasterGain || !sharedAudioCtx) return;
    sharedMasterGain.gain.setTargetAtTime(value / 100, sharedAudioCtx.currentTime, 0.05);
  },
  applySoloState: (channels) => {
    if (!sharedAudioCtx) return;
    const anySoloed = channels.some((ch) => ch.soloed);
    for (let i = 0; i < channels.length; i++) {
      ensureChannel(i);
      if (!sharedGains[i]) continue;
      const ch = channels[i];
      const shouldPlay = !ch.muted && (!anySoloed || ch.soloed);
      sharedGains[i]!.gain.setTargetAtTime(
        shouldPlay ? (ch.value / 100) * 0.3 : 0,
        sharedAudioCtx.currentTime,
        0.05
      );
    }
  },
  getAnalyser: () => sharedAnalyser,
};

export function useAudioEngine(): AudioEngine {
  useEffect(() => {
    engineConsumers += 1;
    return () => {
      engineConsumers = Math.max(0, engineConsumers - 1);
      if (engineConsumers === 0) {
        void suspendSharedAudio();
      }
    };
  }, []);

  return sharedEngine;
}
