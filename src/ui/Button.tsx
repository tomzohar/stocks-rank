import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "tinted" | "ghost" | "destructive" | "link";

/**
 * iOS-style buttons: filled (primary), gray (secondary), tinted, plain
 * (ghost), destructive and link. They dim on press like a native control.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconOnly = false,
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: IconName;
  /** A round icon button; pass an aria-label. */
  iconOnly?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], styles[size], iconOnly && styles.iconOnly, className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}
