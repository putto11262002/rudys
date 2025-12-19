"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
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
import { useSessions, useCreateSession } from "@/hooks/sessions";
import { DeleteSessionButton } from "./_components/delete-session-button";
import type { Session } from "@/lib/db/schema";

const phaseLabels: Record<Session["lastPhase"], string> = {
  "loading-lists": "Loading Lists",
  demand: "Demand Review",
  inventory: "Inventory Capture",
  order: "Order Review",
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

export default function HomePage() {
  const router = useRouter();
  const { data, isLoading, error } = useSessions();
  const createSession = useCreateSession();

  const handleCreateSession = () => {
    createSession.mutate(undefined, {
      onSuccess: (data) => {
        toast.success("Session created");
        router.push(`/sessions/${data.session.id}/loading-lists`);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <main className="container max-w-2xl mx-auto p-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground text-sm">
            Manage your loading list capture sessions
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/products">
              <Package className="size-4 mr-2" />
              Catalog
            </Link>
          </Button>
          <Button
            onClick={handleCreateSession}
            disabled={createSession.isPending}
          >
            {createSession.isPending ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Plus className="size-4 mr-2" />
            )}
            New Session
          </Button>
        </div>
      </div>

      {isLoading ? (
        <SessionsListSkeleton />
      ) : error ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Error loading sessions</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : !data?.sessions.length ? (
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
      ) : (
        <div className="space-y-3">
          {data.sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {formatDateTime(session.createdAt)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      <Badge variant="secondary">
                        {phaseLabels[session.lastPhase]}
                      </Badge>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/sessions/${session.id}/${session.lastPhase}`}>Open</Link>
                    </Button>
                    <DeleteSessionButton sessionId={session.id} />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
