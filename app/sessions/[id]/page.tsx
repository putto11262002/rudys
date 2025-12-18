"use client";

import { useEffect } from "react";
import { useRouter, notFound } from "next/navigation";
import { use } from "react";
import { Loader2 } from "lucide-react";
import { useSession } from "@/hooks/sessions";
import type { Session } from "@/lib/db/schema";

const statusToRoute: Record<Session["status"], string> = {
  draft: "loading-lists",
  capturing_loading_lists: "loading-lists",
  review_demand: "demand",
  capturing_inventory: "inventory",
  review_order: "order",
  completed: "order",
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
      const route = statusToRoute[data.session.status];
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
