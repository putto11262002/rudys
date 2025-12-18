import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/data/sessions";
import { Session } from "@/lib/db/schema";

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

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const session = await getSession(id);

  if (!session) {
    notFound();
  }

  const route = statusToRoute[session.status];
  redirect(`/sessions/${session.id}/${route}`);
}
