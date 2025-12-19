"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GroupCard } from "./group-card";
import { LoadingListCaptureForm } from "./loading-list-capture-form";
import { DEFAULT_MODEL_ID } from "@/components/ai/model-selector";
import { useGroups, type GroupWithImages } from "@/hooks/groups";
import { useStreamingExtraction } from "@/hooks/extraction";

function GroupCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Images section skeleton */}
        <Skeleton className="h-10 w-full rounded-lg" />
        {/* Extracted items section skeleton */}
        <Skeleton className="h-10 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

interface GroupListClientProps {
  sessionId: string;
  initialGroups: GroupWithImages[];
  isLoading?: boolean;
}

export function GroupListClient({
  sessionId,
  initialGroups,
  isLoading = false,
}: GroupListClientProps) {
  // Track which group is currently extracting (only one at a time with streaming)
  const [extractingGroupId, setExtractingGroupId] = useState<string | null>(
    null
  );
  // Track selected model for re-run extraction
  const [lastUsedModel, setLastUsedModel] = useState(DEFAULT_MODEL_ID);

  // Streaming extraction - lifted to parent so GroupCard can show partial results
  const {
    partialResult,
    isExtracting,
    extract,
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

  const handleStarted = (groupId: string, modelId: string) => {
    // Mark this group as extracting and start streaming
    setExtractingGroupId(groupId);
    setLastUsedModel(modelId);
    // Start extraction with selected model
    extract(groupId, modelId);
  };

  return (
    <div className="space-y-4">
      {/* Capture form - always visible at the top */}
      <LoadingListCaptureForm
        sessionId={sessionId}
        onStarted={handleStarted}
      />

      {/* Groups list - newest first (already sorted by data loader) */}
      {isLoading ? (
        <div className="space-y-4 pt-4">
          <Skeleton className="h-5 w-28" />
          <GroupCardSkeleton />
        </div>
      ) : groups.length === 0 ? (
        <div className="pt-4">
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>No loading lists yet</EmptyTitle>
              <EmptyDescription>
                Capture images above to start extracting loading lists.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="space-y-4 pt-4">
          <h2 className="text-base font-medium">
            Captured ({groups.length})
          </h2>
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
                extract(group.id, lastUsedModel);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
