"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { usePrefersReducedMotion } from "./motion";
import styles from "./Sheet.module.css";

/**
 * A modal sheet on the native <dialog>, which traps focus and closes on
 * Escape. It slides up from the bottom on phones and floats centred on wider
 * screens, with an iOS-style grabber and a "Done" button. Tapping the dimmed
 * backdrop closes it too.
 */
export function Sheet({
  open,
  onClose,
  title,
  doneLabel = "Done",
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  doneLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const { dialog, closing, requestClose } = useModal(open, onClose);
  return (
    <dialog
      ref={dialog}
      className={cx(styles.dialog, styles.sheet, closing && styles.closing, className)}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div className={styles.body}>
        <span className={styles.grabber} aria-hidden="true" />
        <header className={styles.bar}>
          <h2>{title}</h2>
          <button type="button" className={styles.done} onClick={() => requestClose()}>
            {doneLabel}
          </button>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </dialog>
  );
}

export interface SheetAction {
  label: string;
  destructive?: boolean;
  onSelect: () => void;
}

/** An iOS action sheet: a short choice, with Cancel set apart. For confirming destructive actions. */
export function ActionSheet({
  open,
  onClose,
  title,
  message,
  actions,
  cancelLabel = "Cancel",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: readonly SheetAction[];
  cancelLabel?: string;
}) {
  const { dialog, closing, requestClose } = useModal(open, onClose);
  return (
    <dialog
      ref={dialog}
      className={cx(styles.dialog, styles.actionSheet, closing && styles.closing)}
      aria-label={title ?? "Choose an action"}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div className={styles.group}>
        {(title || message) && (
          <div className={styles.heading}>
            {title && <strong>{title}</strong>}
            {message && <span>{message}</span>}
          </div>
        )}
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={cx(styles.choice, a.destructive && styles.destructive)}
            onClick={() => requestClose(a.onSelect)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <button type="button" className={cx(styles.group, styles.choice, styles.cancel)} autoFocus onClick={() => requestClose()}>
        {cancelLabel}
      </button>
    </dialog>
  );
}

/** Opens a <dialog> modally while `open`, and plays the exit animation before closing. */
function useModal(open: boolean, onClose: () => void) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const reduced = usePrefersReducedMotion();
  const after = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!closing) return;
    const finish = () => {
      setClosing(false);
      dialog.current?.close();
      onCloseRef.current();
      const then = after.current;
      after.current = null;
      then?.();
    };
    const t = window.setTimeout(finish, reduced ? 0 : 220);
    return () => window.clearTimeout(t);
  }, [closing, reduced]);

  /** Closes the sheet, then runs `then` (so a follow-up isn't hidden behind it). */
  const requestClose = (then?: () => void) => {
    after.current = then ?? null;
    setClosing(true);
  };

  return { dialog, closing, requestClose };
}
