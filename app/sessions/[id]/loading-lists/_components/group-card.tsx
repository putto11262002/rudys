"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ImageIcon,
  FileText,
  Loader2,
  Package,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GroupActionsMenu } from "./group-actions-menu";
import { cn } from "@/lib/utils";
import type { GroupWithImages } from "@/hooks/groups";
import type { LoadingListExtraction } from "@/lib/ai/schemas/loading-list-extraction";

// DeepPartial type for streaming results where any field can be undefined
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

interface GroupCardProps {
  group: GroupWithImages;
  sessionId: string;
  isExtracting?: boolean;
  /** Partial streaming result during extraction */
  streamingResult?: DeepPartial<LoadingListExtraction>;
  /** Callback to re-run extraction for this group */
  onRerunExtraction?: () => void;
}

function StatusBadge({
  groupStatus,
  extractionStatus,
  isExtracting,
}: {
  groupStatus: string;
  extractionStatus?: "success" | "warning" | "error" | null;
  isExtracting?: boolean;
}) {
  if (isExtracting) {
    return (
      <Badge variant="info">
        <Loader2 className="size-3 mr-1 animate-spin" />
        Extracting
      </Badge>
    );
  }

  // Check extraction status for extracted groups
  if (groupStatus === "extracted" || groupStatus === "needs_attention") {
    if (extractionStatus === "error") {
      return (
        <Badge variant="error">
          <AlertCircle className="size-3 mr-1" />
          Error
        </Badge>
      );
    }

    if (extractionStatus === "warning") {
      return (
        <Badge variant="warning">
          <AlertTriangle className="size-3 mr-1" />
          Warning
        </Badge>
      );
    }

    // Success
    return (
      <Badge variant="success">
        <CheckCircle className="size-3 mr-1" />
        Extracted
      </Badge>
    );
  }

  // Pending status
  return (
    <Badge variant="info">
      <Clock className="size-3 mr-1" />
      Pending
    </Badge>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen,
  children,
  count,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen: boolean;
  children: React.ReactNode;
  count?: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4" />
          {title}
          {count !== undefined && (
            <span className="text-muted-foreground">({count})</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ImageGrid({ images }: { images: GroupWithImages["images"] }) {
  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No images
      </p>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {images.map((image) => (
        <div
          key={image.id}
          className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden"
        >
          <Image
            src={image.blobUrl}
            alt="Loading list"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 25vw, 150px"
          />
        </div>
      ))}
    </div>
  );
}

// Normalized extraction data for display (handles both complete and partial)
interface NormalizedExtraction {
  status?: string;
  message?: string | null;
  activities: Array<{ activityCode?: string }>;
  lineItems: Array<{
    activityCode?: string;
    primaryCode?: string;
    description?: string;
    quantity?: number;
  }>;
  summary?: {
    totalActivities?: number;
    totalLineItems?: number;
  };
  // Metadata (only available after extraction completes)
  model?: string | null;
  totalCost?: number | null;
}

function ExtractionDataView({
  extraction,
  isStreaming = false,
}: {
  extraction: NormalizedExtraction;
  isStreaming?: boolean;
}) {
  const { status, message, activities = [], lineItems = [] } = extraction;

  // Filter out items without required fields
  const validLineItems = lineItems.filter(
    (item) => item?.primaryCode && item?.activityCode
  );

  // Group line items by activity code
  const itemsByActivity = new Map<string, typeof validLineItems>();
  for (const item of validLineItems) {
    const code = item.activityCode!;
    if (!itemsByActivity.has(code)) {
      itemsByActivity.set(code, []);
    }
    itemsByActivity.get(code)!.push(item);
  }

  // Get all activity codes (from both activities array and line items)
  const allActivityCodes = new Set([
    ...activities.filter((a) => a?.activityCode).map((a) => a.activityCode!),
    ...validLineItems.map((i) => i.activityCode!),
  ]);

  return (
    <div className="space-y-4">
      {/* Status message */}
      {message && (
        <Badge
          variant={
            status === "error"
              ? "error"
              : status === "warning"
                ? "warning"
                : status === "success"
                  ? "success"
                  : "info"
          }
          className="w-full justify-start"
        >
          {message}
        </Badge>
      )}

      {/* Activities with their line items */}
      {allActivityCodes.size > 0 && (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {Array.from(allActivityCodes).map((activityCode) => {
            const items = itemsByActivity.get(activityCode) ?? [];

            return (
              <div key={activityCode} className="space-y-1">
                {/* Activity header */}
                <div className="text-sm font-medium font-mono text-primary">
                  {activityCode}
                </div>

                {/* Line items for this activity */}
                {items.length > 0 ? (
                  <div className="space-y-1 pl-3 border-l-2 border-muted">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30",
                          isStreaming && "animate-pulse"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Package className="size-3 text-muted-foreground" />
                          <span className="font-mono">{item.primaryCode}</span>
                          {item.description && (
                            <span className="text-muted-foreground truncate max-w-32">
                              {item.description}
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          x{item.quantity ?? 1}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground pl-3 border-l-2 border-muted py-1">
                    No items yet
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state - only show when not streaming */}
      {allActivityCodes.size === 0 && !isStreaming && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No extraction data
        </p>
      )}

      {/* Streaming empty state */}
      {allActivityCodes.size === 0 && isStreaming && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Waiting for data...
        </div>
      )}

      {/* Extraction metadata footer */}
      {!isStreaming && (extraction.model || extraction.totalCost !== undefined) && (
        <div className="flex items-center justify-between pt-3 mt-3 border-t text-xs text-muted-foreground">
          {extraction.model && (
            <span className="font-mono">{extraction.model.split("/")[1] ?? extraction.model}</span>
          )}
          {extraction.totalCost !== undefined && extraction.totalCost !== null && (
            <span>${extraction.totalCost.toFixed(4)}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function GroupCard({
  group,
  sessionId,
  isExtracting = false,
  streamingResult,
  onRerunExtraction,
}: GroupCardProps) {
  const isExtracted =
    group.status === "extracted" || group.status === "needs_attention";
  const hasExtractionResult = group.extractionResult !== null;

  // Use streaming result during extraction, otherwise use stored result
  const displayResult = isExtracting && streamingResult ? streamingResult : group.extractionResult;
  const lineItemCount = displayResult?.lineItems?.filter((i) => i?.primaryCode)?.length ?? 0;

  // Normalize the extraction data for display
  // Note: model and totalCost only exist on stored results, not streaming
  const storedResult = group.extractionResult;
  const normalizedExtraction: NormalizedExtraction | null = displayResult
    ? {
        status: displayResult.status,
        message: displayResult.message,
        activities: (displayResult.activities ?? []) as Array<{ activityCode?: string }>,
        lineItems: (displayResult.lineItems ?? []) as Array<{
          activityCode?: string;
          primaryCode?: string;
          description?: string;
          quantity?: number;
        }>,
        summary: displayResult.summary as NormalizedExtraction["summary"],
        model: storedResult?.model,
        totalCost: storedResult?.totalCost,
      }
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {group.employeeLabel || `Group ${group.id.slice(0, 8)}`}
          <span className="text-sm font-normal text-muted-foreground">
            ({group.images.length} image{group.images.length !== 1 ? "s" : ""})
          </span>
          <StatusBadge
            groupStatus={group.status}
            extractionStatus={group.extractionResult?.status as "success" | "warning" | "error" | undefined}
            isExtracting={isExtracting}
          />
        </CardTitle>
        <CardAction>
          <GroupActionsMenu
            groupId={group.id}
            sessionId={sessionId}
            onRerunExtraction={onRerunExtraction ?? (() => {})}
            isExtracting={isExtracting}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Images collapsible */}
        <CollapsibleSection
          title="Images"
          icon={ImageIcon}
          defaultOpen={!isExtracted && !isExtracting}
          count={group.images.length}
        >
          <ImageGrid images={group.images} />
        </CollapsibleSection>

        {/* Extracted data collapsible - show during extraction with streaming results */}
        {(hasExtractionResult || isExtracting) && normalizedExtraction && (
          <CollapsibleSection
            title={isExtracting ? "Extracting..." : "Extracted Data"}
            icon={FileText}
            defaultOpen={isExtracted || isExtracting}
            count={lineItemCount > 0 ? lineItemCount : undefined}
          >
            <ExtractionDataView
              extraction={normalizedExtraction}
              isStreaming={isExtracting}
            />
          </CollapsibleSection>
        )}

        {/* Extracting state without any streaming data yet */}
        {isExtracting && !normalizedExtraction && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Starting extraction...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
