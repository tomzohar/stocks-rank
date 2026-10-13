"use client";

import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import styles from "./SwipeActions.module.css";

export interface SwipeAction {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onSelect: () => void;
}

const ACTION_WIDTH = 80;
/** Share of the row a swipe must cross to run the first action outright. */
const FULL_SWIPE = 0.6;

interface Gesture {
  x: number;
  y: number;
  base: number;
  /** null until the movement shows whether it's a swipe or a scroll. */
  horizontal: boolean | null;
}

/**
 * A row that slides left to reveal actions, like iOS Mail and Stocks. Swiping
 * far enough runs the first action. Touch and pen only: the same actions
 * must also be reachable another way (an edit mode or a menu).
 */
export function SwipeActions({
  actions,
  open,
  onOpenChange,
  disabled = false,
  className,
  children,
}: {
  actions: readonly SwipeAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const swiped = useRef(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  // The row's width, measured when a gesture starts.
  const [width, setWidth] = useState(320);
  const revealed = actions.length * ACTION_WIDTH;
  const offset = leaving ? -width : (drag ?? (open ? -revealed : 0));

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled || e.pointerType === "mouse") return;
    gesture.current = { x: e.clientX, y: e.clientY, base: open ? -revealed : 0, horizontal: null };
    setWidth(root.current?.offsetWidth ?? 320);
    swiped.current = false;
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!g.horizontal) {
        gesture.current = null;
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      swiped.current = true;
    }
    let next = Math.min(0, g.base + dx);
    // Rubber-band past the full-swipe point.
    const limit = -width * 0.9;
    if (next < limit) next = limit + (next - limit) * 0.25;
    setDrag(next);
  }

  function onPointerUp() {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.horizontal || drag === null) return;
    setDrag(null);
    if (-drag > width * FULL_SWIPE && actions[0]) {
      navigator.vibrate?.(10);
      setLeaving(true);
      window.setTimeout(() => {
        setLeaving(false);
        actions[0].onSelect();
      }, 180);
    } else {
      onOpenChange(-drag > revealed / 2);
    }
  }

  // A swipe or a tap on an open row must not also follow the row's link.
  function onClickCapture(e: MouseEvent) {
    if (swiped.current || open) {
      if ((e.target as HTMLElement).closest(`.${styles.actions}`)) return;
      e.preventDefault();
      e.stopPropagation();
      swiped.current = false;
      if (open) onOpenChange(false);
    }
  }

  const full = leaving || (drag !== null && -drag > width * FULL_SWIPE);

  return (
    <div ref={root} className={cx(styles.swipe, className)} onClickCapture={onClickCapture}>
      <div
        className={cx(styles.actions, full && styles.full)}
        // Hidden at rest, so no sliver shows at the edge while rows move.
        style={{ width: Math.max(revealed, -offset), visibility: offset === 0 ? "hidden" : undefined }}
        aria-hidden={!open}
      >
        {actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            tabIndex={open ? 0 : -1}
            className={cx(styles.action, a.destructive && styles.destructive)}
            style={{ flexGrow: full && i === 0 ? 1 : 0 }}
            onClick={() => {
              onOpenChange(false);
              a.onSelect();
            }}
          >
            {a.icon && <Icon name={a.icon} size={18} />}
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      <div
        className={cx(styles.content, drag !== null && styles.dragging)}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null;
          setDrag(null);
        }}
      >
        {children}
      </div>
    </div>
  );
}
