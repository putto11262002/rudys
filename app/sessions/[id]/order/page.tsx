"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { Copy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrder, type OrderItem } from "@/hooks/order";
import { WorkflowNavigation } from "@/components/workflow-navigation";
import { toast } from "sonner";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Generate order text for copy/paste
 */
function generateOrderText(orderItems: OrderItem[]): string {
  return orderItems
    .filter((item) => item.recommendedOrderQty > 0)
    .map((item) => `${item.productCode}: ${item.recommendedOrderQty}`)
    .join("\n");
}

function OrderSkeleton() {
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Order Items</CardTitle>
        <Skeleton className="h-8 w-8" />
      </CardHeader>
      <CardContent>
        {/* Table rows - only data is async */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 py-3 border-b last:border-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-5" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-6" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function OrderPage({ params }: OrderPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useOrder(id);

  const session = data?.session;
  const orderItems = data?.orderItems ?? [];
  const skippedItems = data?.skippedItems ?? [];

  // Count warnings
  const warningCount = useMemo(
    () => orderItems.filter((item) => item.exceedsMax).length,
    [orderItems]
  );

  // Generate order text client-side
  const orderText = useMemo(() => {
    if (orderItems.length === 0) return "";
    return generateOrderText(orderItems);
  }, [orderItems]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderText);
      toast.success("Order text copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  if (isLoading) {
    return (
      <main className="container max-w-2xl mx-auto p-4 py-8 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Order Review</h1>
          <Skeleton className="h-4 w-48 mt-1" />
        </div>
        <OrderSkeleton />
        <WorkflowNavigation
          prev={{ href: `/sessions/${id}/inventory`, label: "Inventory" }}
          next={{ href: "/", label: "Done" }}
        />
      </main>
    );
  }

  if (error) {
    return (
      <main className="container max-w-2xl mx-auto p-4 py-8 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Order Review</h1>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <WorkflowNavigation
          prev={{ href: `/sessions/${id}/inventory`, label: "Inventory" }}
          next={{ href: "/", label: "Done" }}
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
        <h1 className="text-2xl font-bold tracking-tight">Order Review</h1>
        <p className="text-muted-foreground text-sm">
          Session started{" "}
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(session.createdAt))}
        </p>
      </div>

      {/* Skipped Items Warning */}
      {skippedItems.length > 0 && (
        <Alert className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {skippedItems.length} product{skippedItems.length !== 1 ? "s" : ""} skipped due to missing station data:
            <ul className="mt-2 list-disc list-inside">
              {skippedItems.map((item) => (
                <li key={item.productCode} className="font-mono text-sm">
                  {item.productCode} ({item.reason.replace(/_/g, " ")})
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Banner */}
      {warningCount > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {warningCount} product{warningCount !== 1 ? "s" : ""} exceed
            {warningCount === 1 ? "s" : ""} station max capacity
          </AlertDescription>
        </Alert>
      )}

      {/* Order Items Table */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Order Items</CardTitle>
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={orderItems.length === 0}>
            <Copy className="size-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {orderItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No order items computed
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Demand</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                  <TableHead className="text-right">Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map((item) => (
                  <TableRow key={item.productCode}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className="w-5 flex-shrink-0">
                          {item.exceedsMax && (
                            <AlertTriangle className="size-4 text-amber-500" />
                          )}
                        </span>
                        <span className="font-mono text-sm">{item.productCode}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.demandQty}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.onHandQty}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.maxQty ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.recommendedOrderQty}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <WorkflowNavigation
        prev={{ href: `/sessions/${id}/inventory`, label: "Inventory" }}
        next={{ href: "/", label: "Done" }}
      />
    </main>
  );
}
