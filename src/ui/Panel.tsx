import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Panel.module.css";

/** The app's card surface, with an optional eyebrow, title and header actions. */
export function Panel({
  as: Tag = "section",
  eyebrow,
  title,
  titleId,
  actions,
  className,
  style,
  children,
  ...rest
}: {
  as?: "section" | "div" | "article" | "aside";
  eyebrow?: ReactNode;
  title?: ReactNode;
  titleId?: string;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-busy"?: boolean;
  role?: string;
}) {
  return (
    <Tag className={cx(styles.panel, className)} style={style} {...rest}>
      {(eyebrow || title || actions) && (
        <header className={styles.head}>
          <div>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            {title && (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            )}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

/** Small uppercase label used above titles and figures. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx(styles.eyebrow, className)}>{children}</p>;
}
