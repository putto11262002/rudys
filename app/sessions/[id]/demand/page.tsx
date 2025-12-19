"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSession } from "@/hooks/sessions";
import { useGroups } from "@/hooks/groups";
import { useDemand } from "@/hooks/demand";
import { WorkflowNavigation } from "@/components/workflow-navigation";

interface DemandPageProps {
  params: Promise<{ id: string }>;
}

function DemandSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function DemandPage({ params }: DemandPageProps) {
  const { id } = use(params);
  const { data: sessionData, isLoading: sessionLoading } = useSession(id);
  const { data: groupsData, isLoading: groupsLoading } = useGroups(id);
  const { data: demandData, isLoading: demandLoading } = useDemand(id);

  const isLoading = sessionLoading || groupsLoading || demandLoading;
  const session = sessionData?.session;
  const groups = groupsData?.groups ?? [];

  // Get computed demand items
  const demandItems = (demandData?.items ?? []).map((item) => ({
    productCode: item.productCode,
    totalQuantity: item.demandQty,
    description: item.description,
    sources: item.sources,
  }));

  // Check for extraction warnings/errors
  const groupsWithWarnings = groups.filter(
    (g) => g.extractionResult?.status === "warning"
  );
  const groupsWithErrors = groups.filter(
    (g) => g.extractionResult?.status === "error"
  );

  // Get stats from API response
  const stats = demandData?.stats;

  if (isLoading) {
    return (
      <main className="container max-w-2xl mx-auto p-4 py-8 pb-24">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <DemandSkeleton />
        <WorkflowNavigation
          prev={{ href: `/sessions/${id}/loading-lists`, label: "Loading Lists" }}
          next={{ href: `/sessions/${id}/inventory`, label: "Inventory" }}
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
        <h1 className="text-2xl font-bold tracking-tight">Demand Review</h1>
        <p className="text-muted-foreground text-sm">
          Session started{" "}
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(session.createdAt))}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.totalActivities ?? 0}</div>
            <div className="text-sm text-muted-foreground">Activities</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.totalLineItems ?? 0}</div>
            <div className="text-sm text-muted-foreground">Line Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{demandItems.length}</div>
            <div className="text-sm text-muted-foreground">Unique Products</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">${(stats?.totalCost ?? 0).toFixed(4)}</div>
            <div className="text-sm text-muted-foreground">Extraction Cost</div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {groupsWithErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">
            {groupsWithErrors.length} group{groupsWithErrors.length !== 1 ? "s" : ""} failed
            extraction and {groupsWithErrors.length !== 1 ? "are" : "is"} not included in totals.
          </p>
        </div>
      )}

      {groupsWithWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 text-sm">
            {groupsWithWarnings.length} group{groupsWithWarnings.length !== 1 ? "s" : ""} extracted
            with warnings - review recommended.
          </p>
        </div>
      )}

      {/* Demand Table with Drilldown */}
      <Card>
        <CardHeader>
          <CardTitle>Aggregated Demand</CardTitle>
        </CardHeader>
        <CardContent>
          {demandItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No demand items extracted
            </p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_auto] gap-4 font-medium text-sm border-b pb-2 px-2">
                <div>Product Code</div>
                <div>Quantity</div>
              </div>
              {demandItems.map((item) => (
                <Collapsible key={item.productCode}>
                  <CollapsibleTrigger className="w-full">
                    <div className="grid grid-cols-[1fr_auto] gap-4 py-2 px-2 hover:bg-muted/50 rounded-md transition-colors">
                      <div className="flex items-center gap-2 text-left">
                        <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
                        <div>
                          <div className="font-mono text-sm">{item.productCode}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="font-medium">{item.totalQuantity}</div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 pl-2 border-l-2 border-muted mb-2">
                      <div className="text-xs text-muted-foreground py-1">
                        Sources ({item.sources.length})
                      </div>
                      {item.sources.map((source, idx) => (
                        <div
                          key={`${source.groupId}-${source.activityCode}-${idx}`}
                          className="text-sm py-1 flex items-center gap-2"
                        >
                          <Badge variant="outline" className="text-xs font-normal">
                            {source.employeeLabel ?? "Group"}
                          </Badge>
                          <span className="text-muted-foreground">/</span>
                          <span className="font-mono text-xs">{source.activityCode}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty demand info */}
      {demandItems.length === 0 && (
        <p className="mt-4 text-center text-muted-foreground text-sm">
          Add loading lists and run extraction to generate demand items.
        </p>
      )}

      <WorkflowNavigation
        prev={{ href: `/sessions/${id}/loading-lists`, label: "Loading Lists" }}
        next={{ href: `/sessions/${id}/inventory`, label: "Inventory" }}
      />
    </main>
  );
}
