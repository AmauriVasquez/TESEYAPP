import React, { useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SignaturePad({ open, className, apiRef, tall = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const ctxRef = useRef(null);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const w = parent?.clientWidth || 400;
    const h = tall ? 192 : 160;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctxRef.current = ctx;
    hasInkRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    resize();
    const ro = new ResizeObserver(() => resize());
    const el = canvasRef.current?.parentElement;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [open, resize, tall]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const blockTouch = (e) => e.preventDefault();
    canvas.addEventListener('touchstart', blockTouch, { passive: false });
    canvas.addEventListener('touchmove', blockTouch, { passive: false });

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const sx = (canvas.width / dpr) / r.width;
      const sy = (canvas.height / dpr) / r.height;
      if (e.touches?.[0]) {
        return {
          x: (e.touches[0].clientX - r.left) * sx,
          y: (e.touches[0].clientY - r.top) * sy,
        };
      }
      return {
        x: (e.clientX - r.left) * sx,
        y: (e.clientY - r.top) * sy,
      };
    };

    const start = (e) => {
      e.preventDefault();
      const ctx = ctxRef.current;
      if (!ctx) return;
      drawingRef.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };

    const move = (e) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const ctx = ctxRef.current;
      if (!ctx) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      hasInkRef.current = true;
    };

    const end = () => {
      drawingRef.current = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('touchstart', blockTouch);
      canvas.removeEventListener('touchmove', blockTouch);
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [open, tall]);

  const clear = useCallback(() => {
    resize();
  }, [resize]);

  const isEmpty = useCallback(() => !hasInkRef.current, []);

  const toDataURL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { clear, isEmpty, toDataURL };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, clear, isEmpty, toDataURL, open, tall]);

  return (
    <div className={cn('relative rounded-lg border border-gray-300 bg-white overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        className={cn('w-full touch-none block cursor-crosshair', tall ? 'h-48' : 'h-40')}
        style={{ touchAction: 'none' }}
      />
      <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1" onClick={clear} aria-label="Borrar firma">
        <Eraser className="w-4 h-4" />
      </Button>
    </div>
  );
}
