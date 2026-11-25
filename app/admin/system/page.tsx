import { redirect } from "next/navigation";

/** System checks now live with the other settings. */
export default function SystemPage() {
  redirect("/admin/settings");
}
