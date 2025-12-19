"use client";

import { Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
          <CardTitle className="text-base">Demanded Products</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No demand items. Approve demand first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Demanded Products</span>
          <span className="text-sm font-normal text-muted-foreground">
            {summary.coveredCount}/{summary.totalCount} captured
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coverage.map((item) => (
              <TableRow key={item.productCode}>
                <TableCell>
                  {item.isCaptured ? (
                    <Badge variant="default" className="text-xs">
                      <Check className="size-3 mr-1" />
                      Captured
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <AlertTriangle className="size-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{item.productCode}</span>
                  {item.productDescription && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {item.productDescription}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.onHandQty}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
