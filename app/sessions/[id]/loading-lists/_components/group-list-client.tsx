"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { GroupCard } from "./group-card";
import { DEFAULT_MODEL_ID } from "@/components/ai/model-selector";
import { useGroups, type GroupWithImages } from "@/hooks/groups";
import { useStreamingExtraction } from "@/hooks/extraction";

const LoadingListCaptureForm = dynamic(
  () =>
    import("./loading-list-capture-form").then(
      (m) => m.LoadingListCaptureForm
    ),
  { ssr: false }
);

interface GroupListClientProps {
  sessionId: string;
  initialGroups: GroupWithImages[];
}

export function GroupListClient({
  sessionId,
  initialGroups,
}: GroupListClientProps) {
  // Track which group is currently extracting (only one at a time with streaming)
  const [extractingGroupId, setExtractingGroupId] = useState<string | null>(
    null
  );

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
      {groups.length === 0 ? (
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
                // Use same model as previous extraction, or fallback to default
                const modelToUse = group.extractionResult?.model ?? DEFAULT_MODEL_ID;
                extract(group.id, modelToUse);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
