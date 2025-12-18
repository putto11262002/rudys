"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDeleteStation, useExtractStation } from "@/hooks/stations";
import type { StationCapture } from "@/lib/db/schema";

interface StationCardProps {
  station: StationCapture;
  sessionId: string;
}

export function StationCard({ station, sessionId }: StationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const deleteStation = useDeleteStation();
  const extractStation = useExtractStation();

  const handleDelete = () => {
    deleteStation.mutate(
      { id: station.id, sessionId },
      {
        onSuccess: () => {
          toast.success("Station deleted");
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const handleReExtract = () => {
    extractStation.mutate(
      { id: station.id, sessionId },
      {
        onSuccess: (data) => {
          const status = data.extraction?.status;
          if (status === "success") {
            toast.success("Station re-extracted successfully");
          } else if (status === "warning") {
            toast.warning(
              data.extraction?.message || "Station re-extracted with warnings",
            );
          } else {
            toast.error(
              data.extraction?.message || "Station re-extraction failed",
            );
          }
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const getStatusBadge = () => {
    switch (station.status) {
      case "valid":
        return (
          <Badge variant="success">
            <Check className="size-3 mr-1" />
            Valid
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="error">
            <XCircle className="size-3 mr-1" />
            Failed
          </Badge>
        );
      case "needs_attention":
        return (
          <Badge variant="warning">
            <AlertTriangle className="size-3 mr-1" />
            Warning
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="info">
            <Loader2 className="size-3 mr-1 animate-spin" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const isProcessing = deleteStation.isPending || extractStation.isPending;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg ">
              {getStatusBadge()}
              <span className="font-mono">
                {station.productCode || "Unknown Product"}
              </span>
            </CardTitle>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReExtract}
              disabled={
                isProcessing || !station.signBlobUrl || !station.stockBlobUrl
              }
              title="Re-extract"
            >
              {extractStation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isProcessing}>
                  {deleteStation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Station?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete the station and its images. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Error Alert for Failed Status */}
        {station.status === "failed" && station.errorMessage && (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertTitle>Extraction Failed</AlertTitle>
            <AlertDescription>{station.errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Extracted Data Summary */}
        {station.extractedAt && station.status !== "failed" && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">
                {station.onHandQty ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">On Hand</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{station.minQty ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Min</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{station.maxQty ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Max</div>
            </div>
          </div>
        )}

        {/* Warning message for needs_attention status */}
        {station.status === "needs_attention" && station.errorMessage && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>{station.errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Collapsible Image Preview */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full">
              {isExpanded ? (
                <>
                  <ChevronUp className="size-4 mr-2" />
                  Hide Images
                </>
              ) : (
                <>
                  <ChevronDown className="size-4 mr-2" />
                  Show Images
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-2 gap-2">
              {station.signBlobUrl && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Sign
                  </p>
                  <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden">
                    <Image
                      src={station.signBlobUrl}
                      alt="Station sign"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              {station.stockBlobUrl && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Stock
                  </p>
                  <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden">
                    <Image
                      src={station.stockBlobUrl}
                      alt="Station stock"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
