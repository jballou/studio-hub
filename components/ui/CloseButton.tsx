import type { Ref } from "react";
import { Icon } from "./Icon";

/** The one close button for dialogs, previews and side panels: a secondary icon button with an X. */
export function CloseButton({ onClick, label = "Close", autoFocus, ref, className = "" }: { onClick: () => void; label?: string; autoFocus?: boolean; ref?: Ref<HTMLButtonElement>; className?: string }) {
  return (
    <button ref={ref} onClick={onClick} autoFocus={autoFocus} aria-label={label} title={label} className={`btn btn-icon btn-icon-lg btn-secondary shrink-0 ${className}`}>
      <Icon name="x" size={16} />
    </button>
  );
}
