"use client";

import { use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/sessions";
import { useStations, useCoverage } from "@/hooks/stations";
import { StationCard } from "./_components/station-card";
import { CoverageSummaryCard } from "./_components/coverage-summary";
import { WorkflowNavigation } from "@/components/workflow-navigation";

// Dynamic import to avoid hydration issues with camera input
const StationCaptureForm = dynamic(
  () =>
    import("./_components/station-capture-form").then(
      (mod) => mod.StationCaptureForm
    ),
  { ssr: false }
);

interface InventoryPageProps {
  params: Promise<{ id: string }>;
}

function CoverageSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StationCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function InventoryPage({ params }: InventoryPageProps) {
  const { id } = use(params);

  const { data: sessionData, isLoading: sessionLoading } = useSession(id);
  const { data: stationsData, isLoading: stationsLoading } = useStations(id);
  const { data: coverageData, isLoading: coverageLoading } = useCoverage(id);

  const session = sessionData?.session;
  const stations = stationsData?.stations ?? [];
  const coverage = coverageData?.coverage ?? [];
  const summary = coverageData?.summary ?? {
    canProceed: false,
    coveredCount: 0,
    totalCount: 0,
    percentage: 0,
  };

  // Session not found after loading
  if (!sessionLoading && !session) {
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
      {/* Header - static content shows immediately */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Inventory Capture</h1>
        <p className="text-muted-foreground text-sm">
          Capture station sign and stock photos for each demanded product
        </p>
      </div>

      {/* Station Capture Form - always visible */}
      <div className="mb-6">
        <StationCaptureForm sessionId={id} />
      </div>

      {/* Coverage Summary - skeleton while loading */}
      <div className="mb-6">
        {coverageLoading ? (
          <CoverageSkeleton />
        ) : (
          <CoverageSummaryCard coverage={coverage} summary={summary} />
        )}
      </div>

      {/* Station List - skeleton while loading */}
      {stationsLoading ? (
        <div className="space-y-4 mb-6">
          <Skeleton className="h-5 w-28" />
          <StationCardSkeleton />
        </div>
      ) : stations.length > 0 ? (
        <div className="space-y-4 mb-6">
          <h2 className="text-base font-medium">
            Captured ({stations.length})
          </h2>
          {stations.map((station) => (
            <StationCard key={station.id} station={station} sessionId={id} />
          ))}
        </div>
      ) : null}

      <WorkflowNavigation
        prev={{ href: `/sessions/${id}/demand`, label: "Demand" }}
        next={{ href: `/sessions/${id}/order`, label: "Order" }}
      />
    </main>
  );
}
