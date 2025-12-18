"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
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
import { useUpdateSessionStatus } from "@/hooks/sessions";
import { useGroups, type GroupWithImages } from "@/hooks/groups";
import { useStreamingExtraction } from "@/hooks/extraction";

const CaptureCard = dynamic(
  () => import("./capture-card").then((m) => m.CaptureCard),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    ),
  }
);

interface GroupListClientProps {
  sessionId: string;
  initialGroups: GroupWithImages[];
}

export function GroupListClient({
  sessionId,
  initialGroups,
}: GroupListClientProps) {
  const router = useRouter();
  const [isCapturing, setIsCapturing] = useState(false);
  // Track which group is currently extracting (only one at a time with streaming)
  const [extractingGroupId, setExtractingGroupId] = useState<string | null>(
    null
  );
  const updateSessionStatus = useUpdateSessionStatus();

  // Streaming extraction - lifted to parent so GroupCard can show partial results
  const {
    partialResult,
    isExtracting,
    extract,
    groupId: streamingGroupId,
  } = useStreamingExtraction({
    sessionId,
    onComplete: () => {
      toast.success("Extraction completed");
      setExtractingGroupId(null);
    },
    onError: (error) => {
      toast.error("Extraction failed", {
        description: error.message,
      });
      setExtractingGroupId(null);
    },
  });

  // Use React Query for live updates - initialGroups is fallback only
  const { data: groupsData } = useGroups(sessionId);
  const groups = groupsData?.groups ?? initialGroups;

  // Groups with images (for enabling Continue button)
  const groupsWithImages = groups.filter((g) => g.images.length > 0);
  const hasAnyImages = groupsWithImages.length > 0;
  const isAnyExtracting = extractingGroupId !== null;

  const handleStarted = (groupId: string) => {
    // Mark this group as extracting and start streaming
    setExtractingGroupId(groupId);
    // Close capture card - group will appear in list via revalidation
    setIsCapturing(false);
    // Start extraction
    extract(groupId);
  };

  const handleComplete = () => {
    // Clear extracting state - already handled by streaming onComplete
  };

  const handleContinueToReview = () => {
    if (!hasAnyImages) {
      toast.error("No images to review");
      return;
    }

    // Update session status and navigate to demand page
    updateSessionStatus.mutate(
      { id: sessionId, status: "review_demand" },
      {
        onSuccess: () => {
          router.push(`/sessions/${sessionId}/demand`);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

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
      <div className="space-y-4 pb-24">
        {/* Capture card at the top when active */}
        {isCapturing && (
          <CaptureCard
            sessionId={sessionId}
            onCancel={() => setIsCapturing(false)}
            onStarted={handleStarted}
            onComplete={handleComplete}
          />
        )}

        {/* Groups list - newest first (already sorted by data loader) */}
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            sessionId={sessionId}
            isExtracting={extractingGroupId === group.id && isExtracting}
            streamingResult={
              extractingGroupId === group.id ? partialResult : undefined
            }
            onRerunExtraction={() => {
              // Don't allow if already extracting another group
              if (extractingGroupId !== null) return;
              setExtractingGroupId(group.id);
              extract(group.id);
            }}
          />
        ))}
      </div>

      {/* Floating bottom banner */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="container max-w-2xl mx-auto flex items-center justify-between gap-3">
          {/* Add Loading List - always enabled (async operations) */}
          <Button
            variant="outline"
            onClick={() => setIsCapturing(true)}
            disabled={isCapturing}
          >
            <Plus className="size-4 mr-2" />
            Add Loading List
          </Button>

          {/* Continue to Review - blocked only during extraction */}
          <Button
            onClick={handleContinueToReview}
            disabled={!hasAnyImages || updateSessionStatus.isPending || isAnyExtracting}
          >
            {updateSessionStatus.isPending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : isAnyExtracting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                Continue to Review
                <ArrowRight className="size-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
