import { LocalTime } from "@/ui/LocalTime";
import { BUILT_AT, COMMIT } from "./version";
import styles from "./AppVersion.module.css";

/** "Version d25c7be · built Oct 13, 3:20 PM": which build this window is running. */
export function AppVersion() {
  return (
    <span className={styles.version}>
      Version <code>{COMMIT}</code>
      {BUILT_AT && (
        <>
          {" "}
          · built <LocalTime iso={BUILT_AT} options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} />
        </>
      )}
    </span>
  );
}
