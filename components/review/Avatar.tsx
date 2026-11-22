"use client";

import { useState } from "react";
import { useAvatarUrl } from "@/lib/avatars";
import type { User } from "@/lib/types";

/** A person's picture when they've added one, otherwise their initials. */
export function Avatar({ user, size = 32 }: { user?: User; size?: number }) {
  const url = useAvatarUrl(user?.id);
  const [failed, setFailed] = useState<string | null>(null);
  if (url && failed !== url) {
    // Decorative: the name always sits next to it.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" aria-hidden="true" width={size} height={size} onError={() => setFailed(url)} className="inline-block shrink-0 rounded-round bg-n-150 object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-round font-bold text-n-50 ${user?.role === "creative" ? "bg-brand-dark" : "bg-n-700"}`}
      style={{ width: size, height: size, fontSize: 12 }}
    >
      {user?.initials ?? "?"}
    </span>
  );
}
