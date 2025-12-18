import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/data/sessions";
import { getGroupsWithExtractionResults } from "@/lib/data/extraction";

interface DemandPageProps {
  params: Promise<{ id: string }>;
}

export default async function DemandPage({ params }: DemandPageProps) {
  const { id } = await params;
  const session = await getSession(id);

  if (!session) {
    notFound();
  }

  const groups = await getGroupsWithExtractionResults(id);

  // Aggregate demand from all extraction results
  const demandMap = new Map<
    string,
    {
      productCode: string;
      totalQuantity: number;
      sources: Array<{
        groupId: string;
        employeeLabel: string | null;
        activityCode: string;
        lineItemId: string;
      }>;
    }
  >();

  for (const group of groups) {
    if (!group.extractionResult) continue;

    for (const lineItem of group.extractionResult.lineItems) {
      // Skip partial items that aren't reconciled
      if (lineItem.isPartial && !lineItem.reconciled) continue;

      const existing = demandMap.get(lineItem.primaryCode);
      if (existing) {
        existing.totalQuantity += lineItem.quantity;
        existing.sources.push({
          groupId: group.id,
          employeeLabel: group.employeeLabel,
          activityCode: lineItem.activityCode,
          lineItemId: lineItem.lineItemId,
        });
      } else {
        demandMap.set(lineItem.primaryCode, {
          productCode: lineItem.primaryCode,
          totalQuantity: lineItem.quantity,
          sources: [
            {
              groupId: group.id,
              employeeLabel: group.employeeLabel,
              activityCode: lineItem.activityCode,
              lineItemId: lineItem.lineItemId,
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
    (sum, g) => sum + (g.extractionResult?.summary?.totalLineItemsCounted ?? 0),
    0
  );
  const totalIgnored = groups.reduce(
    (sum, g) => sum + (g.extractionResult?.summary?.totalLineItemsIgnored ?? 0),
    0
  );

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
      {totalIgnored > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 text-sm">
            {totalIgnored} line item{totalIgnored !== 1 ? "s" : ""} ignored
            (partial items not reconciled)
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
                  <div className="font-mono text-sm">{item.productCode}</div>
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
