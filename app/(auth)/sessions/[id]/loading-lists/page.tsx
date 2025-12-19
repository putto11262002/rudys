"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/sessions";
import { useGroups } from "@/hooks/groups";
import { GroupListClient } from "./_components/group-list-client";
import { WorkflowNavigation } from "@/components/workflow-navigation";

interface LoadingListsPageProps {
  params: Promise<{ id: string }>;
}

export default function LoadingListsPage({ params }: LoadingListsPageProps) {
  const { id } = use(params);
  const { data: sessionData, isLoading: sessionLoading } = useSession(id);
  const { data: groupsData, isLoading: groupsLoading } = useGroups(id);

  const session = sessionData?.session;
  const groups = groupsData?.groups ?? [];

  // Session not found (after loading completes)
  if (!sessionLoading && !session) {
    return (
      <main className="container max-w-2xl mx-auto p-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-xl font-semibold">Session not found</h1>
          <Button asChild variant="link" className="mt-4">
            <Link href="/">Back to Sessions</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="container max-w-2xl mx-auto p-4 py-8 pb-24">
      {/* Header - static title, session date loads async */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Loading Lists</h1>
        <p className="text-muted-foreground text-sm">
          {sessionLoading ? (
            <Skeleton className="h-4 w-48 inline-block" />
          ) : session ? (
            <>
              Session started{" "}
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(session.createdAt))}
            </>
          ) : null}
        </p>
      </div>

      {/* Form + Groups list - form shows immediately, only groups list has skeleton */}
      <GroupListClient
        sessionId={id}
        initialGroups={groups}
        isLoading={groupsLoading}
      />

      <WorkflowNavigation
        prev={{ href: "/", label: "Sessions" }}
        next={{ href: `/sessions/${id}/demand`, label: "Demand" }}
      />
    </main>
  );
}
