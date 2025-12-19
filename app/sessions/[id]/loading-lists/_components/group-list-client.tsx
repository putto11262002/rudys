"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Plus, Users } from "lucide-react";
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
import {
  ModelSelector,
  DEFAULT_MODEL_ID,
} from "@/components/ai/model-selector";
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
  const [isCapturing, setIsCapturing] = useState(false);
  // Track which group is currently extracting (only one at a time with streaming)
  const [extractingGroupId, setExtractingGroupId] = useState<string | null>(
    null
  );
  // Model selection for extraction
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);

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

  const isAnyExtracting = extractingGroupId !== null;

  const handleStarted = (groupId: string) => {
    // Mark this group as extracting and start streaming
    setExtractingGroupId(groupId);
    // Close capture card - group will appear in list via revalidation
    setIsCapturing(false);
    // Start extraction with selected model
    extract(groupId, selectedModel);
  };

  const handleComplete = () => {
    // Clear extracting state - already handled by streaming onComplete
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
    <div className="space-y-4">
      {/* Model selector */}
      <div className="flex items-center">
        <ModelSelector
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isAnyExtracting}
        />
      </div>

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
            extract(group.id, selectedModel);
          }}
        />
      ))}
    </div>
  );
}
