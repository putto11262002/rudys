"use client";

import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CoverageItem, CoverageSummary } from "@/hooks/stations";

interface CoverageSummaryCardProps {
  coverage: CoverageItem[];
  summary: CoverageSummary;
}

export function CoverageSummaryCard({
  coverage,
  summary,
}: CoverageSummaryCardProps) {
  if (coverage.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No demand items to cover. Approve demand first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Coverage</span>
          <span className="text-sm font-normal text-muted-foreground">
            {summary.coveredCount}/{summary.totalCount} products
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress value={summary.percentage} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {summary.percentage}% coverage
          </p>
        </div>

        {!summary.canProceed && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              Add stations for all demanded products to continue to order review.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Demanded Products</p>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {coverage.map((item) => (
              <div
                key={item.productCode}
                className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  {item.hasValidStation ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <X className="size-4 text-red-500" />
                  )}
                  <span className="font-mono text-sm">{item.productCode}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  qty: {item.demandQty}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
