"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import styles from "./Menu.module.css";

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  /** Set on every item of a pick-one section: true shows the checkmark. */
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

const enabledItems = (panel: HTMLElement | null) =>
  Array.from(panel?.querySelectorAll<HTMLElement>("[role^=menuitem]:not([aria-disabled=true])") ?? []);

export interface MenuSection {
  title?: string;
  items: readonly MenuItem[];
}

/**
 * An iOS-style pull-down menu: a frosted panel that springs open from its
 * button, with grouped items, checkmarks and destructive actions in red.
 * Keyboard: arrows, Home/End, Escape.
 */
export function Menu({
  label,
  icon,
  children,
  variant = "ghost",
  size = "md",
  align = "end",
  sections,
}: {
  /** Accessible name of the button. */
  label: string;
  icon?: IconName;
  /** Visible button text; without it the button is a round icon. */
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  align?: "start" | "end";
  sections: readonly MenuSection[];
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const items = () => enabledItems(panel.current);

  useEffect(() => {
    if (!open) return;
    enabledItems(panel.current)[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function close(refocus = true) {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => list[(i + list.length) % list.length]?.focus();
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") return setOpen(false);
    else return;
    e.preventDefault();
  }

  return (
    <div ref={root} className={styles.root}>
      <Button
        ref={trigger}
        variant={variant}
        size={size}
        icon={icon}
        iconOnly={!children}
        aria-label={children ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </Button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="menu"
          aria-label={label}
          className={cx(styles.panel, styles[align])}
          onKeyDown={onKeyDown}
        >
          {sections.map((section, s) => {
            const checkable = section.items.some((it) => it.checked !== undefined);
            return (
              <div key={s} role="group" aria-label={section.title} className={styles.section}>
                {section.title && <p className={styles.title}>{section.title}</p>}
                {section.items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    role={it.checked === undefined ? "menuitem" : "menuitemradio"}
                    aria-checked={it.checked}
                    aria-disabled={it.disabled || undefined}
                    tabIndex={-1}
                    className={cx(styles.item, it.destructive && styles.destructive, checkable && styles.checkable)}
                    onClick={() => {
                      if (it.disabled) return;
                      close(false);
                      it.onSelect();
                    }}
                  >
                    {checkable && <span className={styles.check}>{it.checked && <Icon name="check" size={15} />}</span>}
                    <span className={styles.label}>{it.label}</span>
                    {it.icon && <Icon name={it.icon} size={17} className={styles.icon} />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
