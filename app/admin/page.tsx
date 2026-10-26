"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/hooks/useMe";

/** Sends admins to people management and everyone else on the creative team to the brief builder. */
export default function AdminHome() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me) router.replace(me.isAdmin ? "/admin/users" : "/admin/brief");
  }, [me, router]);
  return <p className="p-8 text-sm text-muted">Loading…</p>;
}
