import type { User } from "@/lib/types";

export function Avatar({ user, size = 32 }: { user?: User; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-n-50 ${user?.role === "creative" ? "bg-brand-dark" : "bg-n-700"}`}
      style={{ width: size, height: size, fontSize: 12 }}
    >
      {user?.initials ?? "?"}
    </span>
  );
}
