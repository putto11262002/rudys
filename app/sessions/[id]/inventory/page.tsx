"use client";

import { use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/sessions";
import { useStations, useCoverage } from "@/hooks/stations";
import { StationCard } from "./_components/station-card";
import { CoverageSummaryCard } from "./_components/coverage-summary";

// Dynamic import to avoid hydration issues with camera input
const StationCaptureCard = dynamic(
  () =>
    import("./_components/station-capture-card").then(
      (mod) => mod.StationCaptureCard
    ),
  { ssr: false }
);

interface InventoryPageProps {
  params: Promise<{ id: string }>;
}

function InventorySkeleton() {
  return (
    <>
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-2 w-full mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-6 w-32 mb-2" />
              <div className="grid grid-cols-3 gap-4 mt-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

export default function InventoryPage({ params }: InventoryPageProps) {
  const { id } = use(params);

  const { data: sessionData, isLoading: sessionLoading } = useSession(id);
  const { data: stationsData, isLoading: stationsLoading } = useStations(id);
  const { data: coverageData, isLoading: coverageLoading } = useCoverage(id);

  const isLoading = sessionLoading || stationsLoading || coverageLoading;
  const session = sessionData?.session;
  const stations = stationsData?.stations ?? [];
  const coverage = coverageData?.coverage ?? [];
  const summary = coverageData?.summary ?? {
    canProceed: false,
    coveredCount: 0,
    totalCount: 0,
    percentage: 0,
  };

  if (isLoading) {
    return (
      <main className="container max-w-2xl mx-auto p-4 py-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href={`/sessions/${id}/demand`}>
              <ArrowLeft className="size-4 mr-2" />
              Back to Demand
            </Link>
          </Button>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <InventorySkeleton />
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
          <Link href={`/sessions/${id}/demand`}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Demand
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Inventory Capture</h1>
        <p className="text-muted-foreground text-sm">
          Capture station sign and stock photos for each demanded product
        </p>
      </div>

      {/* Station Capture Card - Primary action, always at top */}
      <div className="mb-6">
        <StationCaptureCard sessionId={id} />
      </div>

      {/* Coverage Summary - What we have vs what we need */}
      <div className="mb-6">
        <CoverageSummaryCard coverage={coverage} summary={summary} />
      </div>

      {/* Station List */}
      {stations.length > 0 && (
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold">
            Stations ({stations.length})
          </h2>
          {stations.map((station) => (
            <StationCard key={station.id} station={station} sessionId={id} />
          ))}
        </div>
      )}

      {/* Continue to Order Button */}
      <Button
        asChild
        className="w-full"
        disabled={!summary.canProceed}
        variant={summary.canProceed ? "default" : "secondary"}
      >
        <Link
          href={summary.canProceed ? `/sessions/${id}/order` : "#"}
          onClick={(e) => {
            if (!summary.canProceed) {
              e.preventDefault();
            }
          }}
        >
          Continue to Order
          <ArrowRight className="size-4 ml-2" />
        </Link>
      </Button>

      {!summary.canProceed && summary.totalCount > 0 && (
        <p className="text-center text-sm text-muted-foreground mt-2">
          All demanded products must have valid stations to continue
        </p>
      )}
    </main>
  );
}
