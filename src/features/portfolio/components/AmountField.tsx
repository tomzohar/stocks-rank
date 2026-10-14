"use client";

import { useId, useState } from "react";
import { cx } from "@/ui/cx";
import { parseAmount } from "../model";
import styles from "./AmountField.module.css";

const asText = (n: number | null) => (n === null ? "" : String(n));

/**
 * A dollar amount: free typing ("1,000", "$250.50"), reported as a number, or
 * null while what's typed isn't one. Follows the value when it's set from outside.
 */
export function AmountField({
  label,
  value,
  onChange,
  help,
  invalid,
  placeholder = "0",
  className,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  help?: string;
  /** Message shown when the value can't be used. */
  invalid?: string | null;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(asText(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    // An emptied field may stand for 0; leave it empty rather than typing a 0 back in.
    if (parseAmount(text) !== value && !(text.trim() === "" && value === 0)) setText(asText(value));
  }
  const describedBy = [help && `${id}-help`, invalid && `${id}-invalid`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.box}>
        <span aria-hidden="true">$</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseAmount(e.target.value);
            setSeen(n);
            onChange(n);
          }}
        />
      </div>
      {help && (
        <p id={`${id}-help`} className={styles.help}>
          {help}
        </p>
      )}
      {invalid && (
        <p id={`${id}-invalid`} className={styles.invalid}>
          {invalid}
        </p>
      )}
    </div>
  );
}
