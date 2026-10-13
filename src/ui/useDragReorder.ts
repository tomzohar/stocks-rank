"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { makeRoomOffset, reorderTarget } from "./reorder";

interface Drag {
  from: number;
  to: number;
  startY: number;
  dy: number;
  centers: number[];
  height: number;
}

/**
 * Drag-to-reorder for a vertical list, iOS style: grab a row's handle, the
 * others slide out of the way, drop to move it. Handles also take ArrowUp and
 * ArrowDown, so reordering works without a pointer.
 */
export function useDragReorder(count: number, onMove: (from: number, to: number) => void) {
  const rows = useRef<(HTMLElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // For one frame after a drop, so rows don't animate from their old offsets.
  const [settling, setSettling] = useState(false);

  const update = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const rowRef = (i: number) => (el: HTMLElement | null) => {
    rows.current[i] = el;
  };

  function drop() {
    const d = dragRef.current;
    if (!d) return;
    update(null);
    if (d.to !== d.from) {
      setSettling(true);
      onMove(d.from, d.to);
      requestAnimationFrame(() => requestAnimationFrame(() => setSettling(false)));
    }
  }

  function handleProps(i: number) {
    return {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (e.button !== 0) return;
        const rects = rows.current.slice(0, count).map((r) => r?.getBoundingClientRect());
        if (rects.length !== count || rects.some((r) => !r)) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        navigator.vibrate?.(8);
        update({
          from: i,
          to: i,
          startY: e.clientY,
          dy: 0,
          centers: rects.map((r) => r!.top + r!.height / 2),
          height: rects[i]!.height,
        });
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const d = dragRef.current;
        if (!d || d.from !== i) return;
        const dy = e.clientY - d.startY;
        update({ ...d, dy, to: reorderTarget(d.centers, d.from, d.centers[d.from] + dy) });
      },
      onPointerUp: drop,
      onPointerCancel: () => update(null),
      onKeyDown(e: KeyboardEvent<HTMLElement>) {
        const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : null;
        if (to === null || to < 0 || to >= count) return;
        e.preventDefault();
        onMove(i, to);
      },
    };
  }

  function rowStyle(i: number): CSSProperties | undefined {
    if (settling) return { transition: "none" };
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, transition: "none", zIndex: 2, position: "relative" };
    const offset = makeRoomOffset(i, drag.from, drag.to, drag.height);
    return offset ? { transform: `translateY(${offset}px)` } : undefined;
  }

  return { rowRef, handleProps, rowStyle, dragging: drag?.from ?? null };
}
