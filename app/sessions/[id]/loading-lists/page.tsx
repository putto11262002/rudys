"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSession } from "@/hooks/sessions";
import { useGroups } from "@/hooks/groups";
import { GroupListClient } from "./_components/group-list-client";
import { WorkflowNavigation } from "@/components/workflow-navigation";

interface LoadingListsPageProps {
  params: Promise<{ id: string }>;
}

function GroupListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-8" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="aspect-[3/4] rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function LoadingListsPage({ params }: LoadingListsPageProps) {
  const { id } = use(params);
  const { data: sessionData, isLoading: sessionLoading } = useSession(id);
  const { data: groupsData, isLoading: groupsLoading } = useGroups(id);

  const isLoading = sessionLoading || groupsLoading;
  const session = sessionData?.session;
  const groups = groupsData?.groups ?? [];

  if (isLoading) {
    return (
      <main className="container max-w-2xl mx-auto p-4 py-8 pb-24">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <GroupListSkeleton />
        <WorkflowNavigation
          prev={{ href: "/", label: "Sessions" }}
          next={{ href: `/sessions/${id}/demand`, label: "Demand" }}
        />
      </main>
    );
  }

  if (!session) {
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Loading Lists</h1>
        <p className="text-muted-foreground text-sm">
          Session started{" "}
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(session.createdAt))}
        </p>
      </div>

      <GroupListClient sessionId={id} initialGroups={groups} />

      <WorkflowNavigation
        prev={{ href: "/", label: "Sessions" }}
        next={{ href: `/sessions/${id}/demand`, label: "Demand" }}
      />
    </main>
  );
}
