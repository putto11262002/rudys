"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CheckCircle,
  AlertCircle,
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
import { DeleteGroupButton } from "./delete-group-button";
import { cn } from "@/lib/utils";
import type { GroupWithImages } from "@/lib/data/groups";
import type {
  Activity,
  LineItem,
  Warning,
} from "@/lib/ai/schemas/loading-list-extraction";

interface GroupCardProps {
  group: GroupWithImages;
  /** Whether extraction is currently in progress */
  isExtracting?: boolean;
}

function StatusBadge({
  status,
  isExtracting,
}: {
  status: string;
  isExtracting?: boolean;
}) {
  if (isExtracting) {
    return (
      <Badge
        variant="default"
        className="bg-blue-100 text-blue-800 hover:bg-blue-100"
      >
        <Loader2 className="size-3 mr-1 animate-spin" />
        Extracting
      </Badge>
    );
  }

  switch (status) {
    case "extracted":
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 hover:bg-green-100"
        >
          <CheckCircle className="size-3 mr-1" />
          Extracted
        </Badge>
      );
    case "needs_attention":
      return (
        <Badge
          variant="default"
          className="bg-amber-100 text-amber-800 hover:bg-amber-100"
        >
          <AlertCircle className="size-3 mr-1" />
          Needs Attention
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge variant="secondary">
          <Clock className="size-3 mr-1" />
          Pending
        </Badge>
      );
  }
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

function ExtractionDataView({
  extraction,
}: {
  extraction: NonNullable<GroupWithImages["extractionResult"]>;
}) {
  const { activities, lineItems, warnings } = extraction;

  const validActivities = activities as Activity[];
  const validLineItems = lineItems as LineItem[];
  const validWarnings = warnings as Warning[];

  // Group line items by activity code
  const itemsByActivity = new Map<string, LineItem[]>();
  for (const item of validLineItems) {
    const code = item.activityCode ?? "Unknown";
    if (!itemsByActivity.has(code)) {
      itemsByActivity.set(code, []);
    }
    itemsByActivity.get(code)!.push(item);
  }

  // Get activity metadata for each code
  const activityMetadata = new Map<string, Activity>();
  for (const activity of validActivities) {
    if (activity.activityCode) {
      activityMetadata.set(activity.activityCode, activity);
    }
  }

  // Get all unique activity codes (from both activities and line items)
  const allActivityCodes = new Set([
    ...validActivities.map((a) => a.activityCode).filter(Boolean),
    ...validLineItems.map((i) => i.activityCode).filter(Boolean),
  ]) as Set<string>;

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {validWarnings.length > 0 && (
        <div className="space-y-1">
          {validWarnings.map((warning, idx) => (
            <div
              key={idx}
              className={cn(
                "text-xs px-2 py-1 rounded",
                warning.severity === "block" && "bg-red-100 text-red-800",
                warning.severity === "warn" && "bg-amber-100 text-amber-800",
                warning.severity === "info" && "bg-blue-100 text-blue-800"
              )}
            >
              {warning.message}
            </div>
          ))}
        </div>
      )}

      {/* Activities with their line items */}
      {allActivityCodes.size > 0 && (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {Array.from(allActivityCodes).map((activityCode) => {
            const activity = activityMetadata.get(activityCode);
            const items = itemsByActivity.get(activityCode) ?? [];

            return (
              <div key={activityCode} className="space-y-1">
                {/* Activity header */}
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="font-mono text-primary">{activityCode}</span>
                  {activity?.room && (
                    <span className="text-muted-foreground">
                      - {activity.room}
                    </span>
                  )}
                  {activity?.endUser && (
                    <span className="text-muted-foreground text-xs">
                      ({activity.endUser})
                    </span>
                  )}
                </div>

                {/* Line items for this activity */}
                {items.length > 0 ? (
                  <div className="space-y-1 pl-3 border-l-2 border-muted">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30",
                          item.isPartial && !item.reconciled && "opacity-50"
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
                          x{item.quantity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground pl-3 border-l-2 border-muted py-1">
                    No items
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {allActivityCodes.size === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No extraction data
        </p>
      )}
    </div>
  );
}

export function GroupCard({ group, isExtracting = false }: GroupCardProps) {
  const isExtracted =
    group.status === "extracted" || group.status === "needs_attention";
  const hasExtractionResult = group.extractionResult !== null;

  const lineItemCount = group.extractionResult?.lineItems?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {group.employeeLabel || `Group ${group.id.slice(0, 8)}`}
          <span className="text-sm font-normal text-muted-foreground">
            ({group.images.length} image{group.images.length !== 1 ? "s" : ""})
          </span>
          <StatusBadge status={group.status} isExtracting={isExtracting} />
        </CardTitle>
        <CardAction>
          <DeleteGroupButton groupId={group.id} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Images collapsible - open by default for pending, closed for extracted */}
        <CollapsibleSection
          title="Images"
          icon={ImageIcon}
          defaultOpen={!isExtracted && !isExtracting}
          count={group.images.length}
        >
          <ImageGrid images={group.images} />
        </CollapsibleSection>

        {/* Extracted data collapsible - only show for extracted groups */}
        {hasExtractionResult && (
          <CollapsibleSection
            title="Extracted Data"
            icon={FileText}
            defaultOpen={isExtracted}
            count={lineItemCount > 0 ? lineItemCount : undefined}
          >
            <ExtractionDataView extraction={group.extractionResult!} />
          </CollapsibleSection>
        )}

        {/* Extracting state */}
        {isExtracting && !hasExtractionResult && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Extracting data from images...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
