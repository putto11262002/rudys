"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/sessions";
import { useGroups } from "@/hooks/groups";

interface DemandPageProps {
  params: Promise<{ id: string }>;
}

function DemandSkeleton() {
  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
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

  const isLoading = sessionLoading || groupsLoading;
  const session = sessionData?.session;
  const groups = groupsData?.groups ?? [];

  // Aggregate demand from all extraction results
  const demandMap = new Map<
    string,
    {
      productCode: string;
      totalQuantity: number;
      description?: string;
      sources: Array<{
        groupId: string;
        employeeLabel: string | null;
        activityCode: string;
      }>;
    }
  >();

  // Check for extraction warnings/errors
  const groupsWithWarnings = groups.filter(
    (g) => g.extractionResult?.status === "warning"
  );
  const groupsWithErrors = groups.filter(
    (g) => g.extractionResult?.status === "error"
  );

  for (const group of groups) {
    if (!group.extractionResult) continue;
    // Skip error groups - their data shouldn't be counted
    if (group.extractionResult.status === "error") continue;

    for (const lineItem of group.extractionResult.lineItems) {
      const existing = demandMap.get(lineItem.primaryCode);
      if (existing) {
        existing.totalQuantity += lineItem.quantity;
        existing.sources.push({
          groupId: group.id,
          employeeLabel: group.employeeLabel,
          activityCode: lineItem.activityCode,
        });
      } else {
        demandMap.set(lineItem.primaryCode, {
          productCode: lineItem.primaryCode,
          totalQuantity: lineItem.quantity,
          description: lineItem.description,
          sources: [
            {
              groupId: group.id,
              employeeLabel: group.employeeLabel,
              activityCode: lineItem.activityCode,
            },
          ],
        });
      }
    }
  }

  const demandItems = Array.from(demandMap.values()).sort((a, b) =>
    a.productCode.localeCompare(b.productCode)
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
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href={`/sessions/${id}/loading-lists`}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Loading Lists
          </Link>
        </Button>
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
      <div className="grid grid-cols-3 gap-4 mb-6">
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

      {/* Demand Table */}
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
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto] gap-4 font-medium text-sm border-b pb-2">
                <div>Product Code</div>
                <div>Quantity</div>
              </div>
              {demandItems.map((item) => (
                <div
                  key={item.productCode}
                  className="grid grid-cols-[1fr_auto] gap-4 py-2 border-b last:border-b-0"
                >
                  <div>
                    <div className="font-mono text-sm">{item.productCode}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <div className="font-medium">{item.totalQuantity}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for approve button - T5 will implement this */}
      <div className="mt-6 text-center text-muted-foreground text-sm">
        <p>Demand approval will be implemented in T5</p>
      </div>
    </main>
  );
}
