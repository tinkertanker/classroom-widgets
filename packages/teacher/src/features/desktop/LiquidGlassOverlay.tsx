import React, { useEffect, useRef } from 'react';

interface LiquidGlassOverlayProps {
  active: boolean;
}

const LiquidGlassOverlay: React.FC<LiquidGlassOverlayProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const frameInterval = 1000 / 30;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame: number | null = null;
    let lastFrameTime = 0;
    let width = 0;
    let height = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let hover = 0;
    let targetHover = 0;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(performance.now());
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / Math.max(1, rect.width);
      pointerY = (event.clientY - rect.top) / Math.max(1, rect.height);
      targetHover = 1;
      if (reducedMotion) {
        hover = 1;
        draw(performance.now());
      } else {
        scheduleFrame();
      }
    };

    const handlePointerLeave = () => {
      targetHover = 0;
      if (reducedMotion) {
        hover = 0;
        draw(performance.now());
      } else {
        scheduleFrame();
      }
    };

    const draw = (time: number) => {
      if (width <= 0 || height <= 0) {
        return;
      }

      context.clearRect(0, 0, width, height);

      const radius = Math.max(1, Math.min(width, height) * (0.25 + hover * 0.18));
      const centerX = pointerX * width;
      const centerY = pointerY * height;
      const pulse = Math.sin(time / 550) * 0.5 + 0.5;

      const shine = context.createRadialGradient(
        centerX,
        centerY,
        radius * 0.08,
        centerX,
        centerY,
        radius
      );
      shine.addColorStop(0, `rgba(255, 255, 255, ${0.18 + hover * 0.08})`);
      shine.addColorStop(0.35, `rgba(255, 255, 255, ${0.05 + pulse * 0.04})`);
      shine.addColorStop(1, 'rgba(255, 255, 255, 0)');

      context.globalCompositeOperation = 'screen';
      context.fillStyle = shine;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = `rgba(255, 255, 255, ${0.28 + hover * 0.12})`;
      context.lineWidth = 1;
      context.strokeRect(0.5, 0.5, Math.max(0, width - 1), Math.max(0, height - 1));

      context.globalAlpha = 0.22;
      context.lineWidth = 0.8;
      for (let i = 0; i < 5; i += 1) {
        const y = ((time / 28) + i * 31) % Math.max(1, height);
        const gradient = context.createLinearGradient(0, y, width, y + 18);
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.strokeStyle = gradient;
        context.beginPath();
        context.moveTo(12, y);
        context.bezierCurveTo(width * 0.3, y - 14, width * 0.65, y + 18, width - 12, y);
        context.stroke();
      }
      context.globalAlpha = 1;
    };

    const animate = (time: number) => {
      frame = null;

      if (time - lastFrameTime < frameInterval) {
        scheduleFrame();
        return;
      }

      lastFrameTime = time;
      hover += (targetHover - hover) * 0.22;

      if (Math.abs(targetHover - hover) < 0.01) {
        hover = targetHover;
      }

      draw(time);

      if (targetHover > 0 || hover > 0) {
        scheduleFrame();
      }
    };

    function scheduleFrame() {
      if (!reducedMotion && frame === null) {
        frame = window.requestAnimationFrame(animate);
      }
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    parent.addEventListener('pointermove', handlePointerMove);
    parent.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      observer.disconnect();
      parent.removeEventListener('pointermove', handlePointerMove);
      parent.removeEventListener('pointerleave', handlePointerLeave);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="desktop-liquid-glass-overlay"
      aria-hidden="true"
    />
  );
};

export default LiquidGlassOverlay;
