"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, CheckCircle2, Loader2 } from "lucide-react";
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
import { useDemand, useApproveDemand } from "@/hooks/demand";
import { toast } from "sonner";

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
  const router = useRouter();
  const { data: sessionData, isLoading: sessionLoading } = useSession(id);
  const { data: groupsData, isLoading: groupsLoading } = useGroups(id);
  const { data: demandData, isLoading: demandLoading } = useDemand(id);
  const { mutate: approveDemand, isPending: isApproving } = useApproveDemand();

  const isLoading = sessionLoading || groupsLoading || demandLoading;
  const session = sessionData?.session;
  const groups = groupsData?.groups ?? [];

  // Check if demand is already approved
  const isApproved = demandData?.approved ?? false;
  const snapshot = demandData?.snapshot;
  const computed = demandData?.computed;

  // Use snapshot if approved, otherwise use computed
  const demandItems = isApproved
    ? (snapshot?.items ?? []).map((item) => ({
        productCode: item.productCode,
        totalQuantity: item.demandQty,
        description: item.description,
        sources: item.sources,
      }))
    : (computed?.items ?? []).map((item) => ({
        productCode: item.productCode,
        totalQuantity: item.demandQty,
        description: item.description,
        sources: item.sources,
      }));

  // Check for extraction warnings/errors (only relevant when not approved)
  const groupsWithWarnings = groups.filter(
    (g) => g.extractionResult?.status === "warning"
  );
  const groupsWithErrors = groups.filter(
    (g) => g.extractionResult?.status === "error"
  );

  // Calculate summary stats
  const totalActivities = groups.reduce(
    (sum, g) => sum + (g.extractionResult?.summary?.totalActivities ?? 0),
    0
  );
  const totalLineItems = groups.reduce(
    (sum, g) => sum + (g.extractionResult?.summary?.totalLineItems ?? 0),
    0
  );
  const totalExtractionCost = groups.reduce(
    (sum, g) => sum + (g.extractionResult?.totalCost ?? 0),
    0
  );

  const handleApprove = () => {
    approveDemand(id, {
      onSuccess: () => {
        toast.success("Demand approved successfully");
        router.push(`/sessions/${id}/inventory`);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  if (isLoading) {
    return (
      <main className="container max-w-2xl mx-auto p-4 py-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href={`/sessions/${id}/loading-lists`}>
              <ArrowLeft className="size-4 mr-2" />
              Back to Loading Lists
            </Link>
          </Button>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <DemandSkeleton />
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
    <main className="container max-w-2xl mx-auto p-4 py-8">
      <div className="mb-6">
        {!isApproved && (
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href={`/sessions/${id}/loading-lists`}>
              <ArrowLeft className="size-4 mr-2" />
              Back to Loading Lists
            </Link>
          </Button>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Demand Review</h1>
          {isApproved && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle2 className="size-3 mr-1" />
              Approved
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Session started{" "}
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(session.createdAt))}
          {isApproved && snapshot && (
            <>
              {" "}
              &bull; Approved{" "}
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(snapshot.approvedAt))}
            </>
          )}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalActivities}</div>
            <div className="text-sm text-muted-foreground">Activities</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalLineItems}</div>
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
            <div className="text-2xl font-bold">${totalExtractionCost.toFixed(4)}</div>
            <div className="text-sm text-muted-foreground">Extraction Cost</div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings (only show when not approved) */}
      {!isApproved && groupsWithErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">
            {groupsWithErrors.length} group{groupsWithErrors.length !== 1 ? "s" : ""} failed
            extraction and {groupsWithErrors.length !== 1 ? "are" : "is"} not included in totals.
          </p>
        </div>
      )}

      {!isApproved && groupsWithWarnings.length > 0 && (
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

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end gap-3">
        {isApproved ? (
          <Button asChild>
            <Link href={`/sessions/${id}/inventory`}>
              Continue to Inventory
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>
        ) : (
          <Button
            onClick={handleApprove}
            disabled={demandItems.length === 0 || isApproving}
          >
            {isApproving && <Loader2 className="size-4 mr-2 animate-spin" />}
            Approve Demand
            <ArrowRight className="size-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Empty demand warning */}
      {!isApproved && demandItems.length === 0 && (
        <p className="mt-4 text-center text-muted-foreground text-sm">
          Add loading lists and run extraction to generate demand items.
        </p>
      )}
    </main>
  );
}
