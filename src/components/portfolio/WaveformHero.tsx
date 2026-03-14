import { memo, useRef, useEffect } from "react";

const WaveformHero = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.008;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const lineCount = 12;
      for (let l = 0; l < lineCount; l++) {
        const phase = (l / lineCount) * Math.PI * 0.6;
        const alpha = 0.15 + (l / lineCount) * 0.35;
        ctx.beginPath();
        ctx.strokeStyle = `hsla(180, 100%, 50%, ${alpha})`;
        ctx.lineWidth = 1;

        for (let x = 0; x <= w; x += 2) {
          const nx = x / w;
          // Envelope: stronger on left, fading right
          const envelope = Math.pow(Math.sin(nx * Math.PI), 1.2) * (1 - nx * 0.5);
          const freq1 = Math.sin(nx * 8 + t * 2 + phase) * 0.6;
          const freq2 = Math.sin(nx * 14 - t * 1.3 + phase * 1.5) * 0.3;
          const freq3 = Math.sin(nx * 22 + t * 0.7 + phase * 2) * 0.1;
          const y = h * 0.55 + (freq1 + freq2 + freq3) * envelope * h * 0.28;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 -translate-y-16 md:-translate-y-20 lg:-translate-y-24 w-full h-full"
      style={{ opacity: 0.9 }}
    />
  );
});

WaveformHero.displayName = "WaveformHero";
export default WaveformHero;
