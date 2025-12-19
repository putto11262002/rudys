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
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg transition-colors bg-muted/50 hover:bg-muted">
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
  summary?: {
    totalActivities?: number;
    totalLineItems?: number;
  };
  // Metadata (only available after extraction completes)
  model?: string | null;
  totalCost?: number | null;
}

// Item type for display
interface DisplayItem {
  activityCode: string;
  productCode: string;
  quantity: number;
  description?: string | null;
}

function ExtractionDataView({
  extraction,
  items,
  isStreaming = false,
}: {
  extraction: NormalizedExtraction;
  items: DisplayItem[];
  isStreaming?: boolean;
}) {
  const { status, message, activities = [] } = extraction;

  // Group items by activity code
  const itemsByActivity = new Map<string, DisplayItem[]>();
  for (const item of items) {
    if (!itemsByActivity.has(item.activityCode)) {
      itemsByActivity.set(item.activityCode, []);
    }
    itemsByActivity.get(item.activityCode)!.push(item);
  }

  // Get all activity codes (from both activities array and items)
  const allActivityCodes = new Set([
    ...activities.filter((a) => a?.activityCode).map((a) => a.activityCode!),
    ...items.map((i) => i.activityCode),
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
            const activityItems = itemsByActivity.get(activityCode) ?? [];

            return (
              <div key={activityCode} className="space-y-1">
                {/* Activity header */}
                <div className="text-sm font-medium font-mono text-primary">
                  {activityCode}
                </div>

                {/* Line items for this activity */}
                {activityItems.length > 0 ? (
                  <div className="space-y-1 pl-3 border-l-2 border-muted">
                    {activityItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30",
                          isStreaming && "animate-pulse"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Package className="size-3 text-muted-foreground" />
                          <span className="font-mono">{item.productCode}</span>
                          {item.description && (
                            <span className="text-muted-foreground truncate max-w-32">
                              {item.description}
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          x{item.quantity}
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
      {allActivityCodes.size === 0 && !isStreaming && items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No extraction data
        </p>
      )}

      {/* Streaming empty state */}
      {allActivityCodes.size === 0 && isStreaming && items.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Waiting for data...
        </div>
      )}

      {/* Extraction metadata footer */}
      {!isStreaming && (extraction.model || extraction.totalCost !== undefined) && (
        <div className="flex items-center justify-between pt-3 mt-3 border-t text-xs text-muted-foreground">
          {extraction.model && (
            <span className="font-mono">
              {extraction.model.split("/")[1] ?? extraction.model}
            </span>
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
  const hasExtractionResult = group.extraction !== null;

  // Get items from group
  const storedItems = group.items ?? [];

  // During streaming, build items from streaming result
  const streamingItems: DisplayItem[] = [];
  if (isExtracting && streamingResult?.lineItems) {
    for (const item of streamingResult.lineItems) {
      if (!item?.primaryCode || !item?.activityCode) continue;
      streamingItems.push({
        activityCode: item.activityCode,
        productCode: item.primaryCode,
        quantity: item.quantity ?? 1,
        description: item.description,
      });
    }
  }

  // Use streaming or stored items
  const displayItems: DisplayItem[] = isExtracting
    ? streamingItems
    : storedItems.map((item) => ({
        activityCode: item.activityCode,
        productCode: item.productCode,
        quantity: item.quantity,
        description: item.description,
      }));

  const lineItemCount = displayItems.length;

  // Use streaming result during extraction for activities view, otherwise use stored
  const displayResult = isExtracting && streamingResult ? streamingResult : group.extraction;

  // Normalize the extraction data for display
  const normalizedExtraction: NormalizedExtraction | null = displayResult
    ? {
        status: displayResult.status,
        message: displayResult.message,
        activities: (
          (displayResult as typeof group.extraction)?.rawActivities ??
          (displayResult as DeepPartial<LoadingListExtraction>).activities ??
          []
        ) as Array<{ activityCode?: string }>,
        summary: displayResult.summary as NormalizedExtraction["summary"],
        model: group.extraction?.model,
        totalCost: group.extraction?.totalCost,
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
            extractionStatus={
              group.extraction?.status as "success" | "warning" | "error" | undefined
            }
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
            title={isExtracting ? "Extracting..." : "Extracted Items"}
            icon={FileText}
            defaultOpen={isExtracted || isExtracting}
            count={lineItemCount > 0 ? lineItemCount : undefined}
          >
            <ExtractionDataView
              extraction={normalizedExtraction}
              items={displayItems}
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
