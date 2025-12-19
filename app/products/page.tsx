"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PRODUCT_CATALOG } from "@/lib/products/catalog";

export default function ProductCatalogPage() {
  return (
    <main className="container max-w-4xl mx-auto p-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button asChild variant="ghost" size="icon">
          <Link href="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Catalog</h1>
          <p className="text-muted-foreground text-sm">
            {PRODUCT_CATALOG.length} products
          </p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Article Number</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Min</TableHead>
            <TableHead className="text-right">Max</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PRODUCT_CATALOG.map((product) => (
            <TableRow key={product.articleNumber}>
              <TableCell className="font-mono text-sm">
                {product.articleNumber}
              </TableCell>
              <TableCell className="text-sm">
                {product.description}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {product.minQty}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {product.maxQty}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
