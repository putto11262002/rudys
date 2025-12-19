"use client";

import { useEffect } from "react";
import { useRouter, notFound } from "next/navigation";
import { use } from "react";
import { Loader2 } from "lucide-react";
import { useSession } from "@/hooks/sessions";
import type { Session } from "@/lib/db/schema";

// Map lastPhase to route
const phaseToRoute: Record<Session["lastPhase"], string> = {
  "loading-lists": "loading-lists",
  demand: "demand",
  inventory: "inventory",
  order: "order",
};

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default function SessionPage({ params }: SessionPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading, error } = useSession(id);

  useEffect(() => {
    if (data?.session) {
      const route = phaseToRoute[data.session.lastPhase] ?? "loading-lists";
      router.replace(`/sessions/${data.session.id}/${route}`);
    }
  }, [data, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.session) {
    notFound();
  }

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
