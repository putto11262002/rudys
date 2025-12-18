"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Card, CardContent } from "@/components/ui/card";
import { GroupCard } from "./group-card";
import type { GroupWithImages } from "@/lib/data/groups";

const CaptureCard = dynamic(() => import("./capture-card").then((m) => m.CaptureCard), {
  ssr: false,
  loading: () => (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  ),
});

interface GroupListClientProps {
  sessionId: string;
  initialGroups: GroupWithImages[];
}

export function GroupListClient({ sessionId, initialGroups }: GroupListClientProps) {
  const router = useRouter();
  const [isCapturing, setIsCapturing] = useState(false);
  const groups = initialGroups;

  const handleCaptureComplete = () => {
    setIsCapturing(false);
    router.refresh();
  };

  const hasAnyImages = groups.some((g) => g.images.length > 0);

  if (groups.length === 0 && !isCapturing) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No loading lists yet</EmptyTitle>
          <EmptyDescription>
            Add a loading list to start capturing images.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => setIsCapturing(true)}>
          <Plus className="size-4 mr-2" />
          Add Loading List
        </Button>
      </Empty>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {isCapturing && (
          <CaptureCard
            sessionId={sessionId}
            onCancel={() => setIsCapturing(false)}
            onComplete={handleCaptureComplete}
          />
        )}

        {groups.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>

      <div className="flex items-center justify-between mt-6">
        {!isCapturing && (
          <Button variant="outline" onClick={() => setIsCapturing(true)}>
            <Plus className="size-4 mr-2" />
            Add Loading List
          </Button>
        )}
        {isCapturing && <div />}
        <Button asChild disabled={!hasAnyImages}>
          <Link href={`/sessions/${sessionId}/demand`}>
            Continue to Review
            <ArrowRight className="size-4 ml-2" />
          </Link>
        </Button>
      </div>
    </>
  );
}
