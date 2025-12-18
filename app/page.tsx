import { Suspense } from "react";
import Link from "next/link";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { getSessions } from "@/lib/data/sessions";
import { createSession } from "@/lib/actions/sessions";
import { Session } from "@/lib/db/schema";
import { DeleteSessionButton } from "./_components/delete-session-button";

const statusLabels: Record<Session["status"], string> = {
  draft: "Draft",
  capturing_loading_lists: "Capturing Loading Lists",
  review_demand: "Review Demand",
  capturing_inventory: "Capturing Inventory",
  review_order: "Review Order",
  completed: "Completed",
};

const statusVariants: Record<
  Session["status"],
  "default" | "secondary" | "outline"
> = {
  draft: "outline",
  capturing_loading_lists: "secondary",
  review_demand: "secondary",
  capturing_inventory: "secondary",
  review_order: "secondary",
  completed: "default",
};

function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function SessionsListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

async function SessionsList() {
  const sessions = await getSessions();

  if (sessions.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No sessions yet</EmptyTitle>
          <EmptyDescription>
            Start a new session to capture loading lists and create orders.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <Card key={session.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {formatDateTime(session.createdAt)}
                </CardTitle>
                <CardDescription className="mt-1">
                  <Badge variant={statusVariants[session.status]}>
                    {statusLabels[session.status]}
                  </Badge>
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/sessions/${session.id}`}>Open</Link>
                </Button>
                <DeleteSessionButton sessionId={session.id} />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="container max-w-2xl mx-auto p-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground text-sm">
            Manage your loading list capture sessions
          </p>
        </div>
        <form action={createSession}>
          <Button type="submit">
            <Plus className="size-4 mr-2" />
            New Session
          </Button>
        </form>
      </div>

      <Suspense fallback={<SessionsListSkeleton />}>
        <SessionsList />
      </Suspense>
    </main>
  );
}
