"use client";

import * as React from "react";

/** A small canvas to draw a signature with a finger or mouse. Reports a PNG data URL (null when empty). */
export function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const inked = React.useRef(false);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ref.current!.getContext("2d")!;
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    inked.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(inked.current ? ref.current!.toDataURL("image/png") : null);
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    inked.current = false;
    onChange(null);
  };
  return (
    <div className="space-y-1">
      <canvas ref={ref} width={600} height={160} className="w-full touch-none rounded-md border bg-white" style={{ cursor: "crosshair" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="Signature pad" />
      <button type="button" className="text-xs text-muted-foreground underline" onClick={clear}>Clear</button>
    </div>
  );
}
