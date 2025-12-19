import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });

  if (!session) {
    notFound();
  }

  const route = phaseToRoute[session.lastPhase] ?? "loading-lists";
  redirect(`/sessions/${session.id}/${route}`);
}
