"use client";

import { useId, useState } from "react";
import { looksLikeAnthropicKey, setApiKey } from "@/features/analysis/browser-store";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import styles from "./ApiKeyForm.module.css";

/**
 * Asks for the viewer's Claude API key. The key is kept in this browser and
 * sent only to api.anthropic.com; it is never sent to the stocks-rank server.
 */
export function ApiKeyForm({ submitLabel = "Use key" }: { submitLabel?: string }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <form
      className={styles.form}
      // No action: the key never leaves the page through a form submission.
      onSubmit={(e) => {
        e.preventDefault();
        if (!looksLikeAnthropicKey(value)) {
          setProblem("That doesn't look like a Claude API key. They start with sk-ant-.");
          return;
        }
        setApiKey(value, remember);
        setValue("");
        setProblem(null);
      }}
    >
      <label htmlFor={`${id}-key`} className={styles.label}>
        Claude API key
      </label>
      <div className={styles.row}>
        <div className={styles.field}>
          <Icon name="key" size={15} className={styles.fieldIcon} />
          <input
            id={`${id}-key`}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`${id}-help${problem ? ` ${id}-problem` : ""}`}
          />
        </div>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
      <label className={styles.remember}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Remember on this device
      </label>
      {problem && (
        <p id={`${id}-problem`} className={styles.problem} role="alert">
          {problem}
        </p>
      )}
      <p id={`${id}-help`} className={styles.help}>
        Your key stays in this browser ({remember ? "until you forget it" : "until you close this tab"}) and is sent only
        to Anthropic. It never reaches the stocks-rank server. Each request to Claude is billed to your Anthropic account. Create
        a key in the{" "}
        <a href="https://platform.claude.com" target="_blank" rel="noopener noreferrer">
          Claude Console
        </a>
        .
      </p>
    </form>
  );
}
