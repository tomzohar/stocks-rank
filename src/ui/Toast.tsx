"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import styles from "./Toast.module.css";

/**
 * A short-lived confirmation at the bottom of the screen, above the tab bar,
 * with an optional action such as Undo. Dismisses itself after `duration`.
 * Rendered into <body>, so an animated ancestor can't move it off the screen
 * edge; show it only in response to something the user did, never on load.
 */
export function Toast({
  icon,
  children,
  action,
  onDismiss,
  duration = 5000,
  className,
}: {
  icon?: IconName;
  children: ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
  duration?: number;
  className?: string;
}) {
  // The timer starts once; give the toast a new key to show a new message.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  useEffect(() => {
    const t = window.setTimeout(() => dismiss.current(), duration);
    return () => window.clearTimeout(t);
  }, [duration]);

  return createPortal(
    <div className={cx(styles.toast, className)} role="status">
      {icon && <Icon name={icon} size={17} className={styles.icon} />}
      <span className={styles.text}>{children}</span>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
        >
          {action.label}
        </button>
      )}
    </div>,
    document.body,
  );
}
