import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/data/sessions";
import { getGroupsWithImages } from "@/lib/data/groups";
import { GroupListClient } from "./_components/group-list-client";

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

async function GroupList({ sessionId }: { sessionId: string }) {
  const groups = await getGroupsWithImages(sessionId);
  return <GroupListClient sessionId={sessionId} initialGroups={groups} />;
}

export default async function LoadingListsPage({
  params,
}: LoadingListsPageProps) {
  const { id } = await params;
  const session = await getSession(id);

  if (!session) {
    notFound();
  }

  return (
    <main className="container max-w-2xl mx-auto p-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/">
            <ArrowLeft className="size-4 mr-2" />
            Back to Sessions
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Loading Lists</h1>
        <p className="text-muted-foreground text-sm">
          Session started{" "}
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(session.createdAt))}
        </p>
      </div>

      <Suspense fallback={<GroupListSkeleton />}>
        <GroupList sessionId={id} />
      </Suspense>
    </main>
  );
}
