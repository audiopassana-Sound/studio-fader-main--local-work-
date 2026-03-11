import { useRef, useEffect, memo } from "react";

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  masterBrightness: number;
  /** Simulated amplitude 0-1 based on fader state + playing */
  amplitude: number;
}

const COLORS = [
  "hsl(320, 80%, 60%)", // pink
  "hsl(260, 70%, 55%)", // purple
  "hsl(210, 90%, 55%)", // blue
  "hsl(30, 90%, 55%)", // orange
  "hsl(170, 70%, 50%)", // teal
];

const AudioVisualizer = memo(({ analyserNode, masterBrightness, amplitude }: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const smoothAmpRef = useRef(0);

  // Keep rapidly-changing values out of the effect deps to avoid re-initializing the canvas loop.
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ampRef = useRef(0);
  const brightnessRef = useRef(1);

  useEffect(() => {
    analyserRef.current = analyserNode;
  }, [analyserNode]);

  useEffect(() => {
    ampRef.current = amplitude;
  }, [amplitude]);

  useEffect(() => {
    brightnessRef.current = masterBrightness;
  }, [masterBrightness]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let freqArray = new Uint8Array(128);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      timeRef.current += 0.008;
      const t = timeRef.current;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      const analyser = analyserRef.current;
      if (analyser) {
        analyser.fftSize = 256;
        const needed = analyser.frequencyBinCount;
        if (freqArray.length !== needed) freqArray = new Uint8Array(needed);
        analyser.getByteFrequencyData(freqArray);
      } else {
        // keep array but effectively silent
        freqArray.fill(0);
      }

      // Smooth amplitude transition (lerp toward target)
      const target = ampRef.current;
      smoothAmpRef.current += (target - smoothAmpRef.current) * 0.08;
      const amp01 = smoothAmpRef.current;

      const isIdle = amp01 < 0.01;
      const idleBreath = isIdle ? 0.03 + Math.sin(t * 0.4) * 0.015 : 0;
      const effectiveAmp = isIdle ? idleBreath : amp01;

      const brightness = brightnessRef.current;

      ctx.clearRect(0, 0, w, h);

      const timeSpeed = isIdle ? 0.3 : 0.8 + effectiveAmp * 1.5;

      for (let wave = 0; wave < 5; wave++) {
        const color = COLORS[wave];
        const phaseOffset = wave * 1.3;
        const freqMult = 1.5 + wave * 0.7;
        const ampBase = 0.04 + wave * 0.02;
        const waveAmp = (ampBase + effectiveAmp * 0.4) * h * brightness;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 + effectiveAmp * 4;
        ctx.globalAlpha = Math.max(0.05, 0.1 + effectiveAmp * 0.7) * brightness;

        const steps = 120;
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * w;
          const norm = i / steps;

          const freqIdx = Math.floor(norm * (freqArray.length - 1));
          const freqVal = analyser && !isIdle
            ? freqArray[freqIdx] / 255
            : effectiveAmp * (0.5 + Math.sin(norm * 6 + t + wave) * 0.5);

          const y =
            h / 2 +
            Math.sin(norm * Math.PI * freqMult + t * timeSpeed * (1 + wave * 0.2) + phaseOffset) *
              waveAmp *
              (0.4 + freqVal * 0.9) +
            Math.sin(norm * Math.PI * 3 + t * timeSpeed * 0.5 + wave) * waveAmp * 0.15;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.shadowColor = color;
        ctx.shadowBlur = 8 + effectiveAmp * 35;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = Math.max(0.03, 0.05 + effectiveAmp * 0.25) * brightness;
      for (let i = 0; i < 6; i++) {
        const cx = w * (0.15 + i * 0.14) + Math.sin(t * timeSpeed * 0.3 + i * 1.1) * (20 + effectiveAmp * 20);
        const cy = h * 0.5 + Math.cos(t * timeSpeed * 0.2 + i * 0.9) * h * (0.1 + effectiveAmp * 0.15);
        const r = 10 + effectiveAmp * 50 + Math.sin(t + i) * 8;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, r), 0, Math.PI * 2);
        ctx.strokeStyle = COLORS[i % COLORS.length];
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-[2]"
      style={{ mixBlendMode: "screen" }}
    />
  );
});

AudioVisualizer.displayName = "AudioVisualizer";
export default AudioVisualizer;

