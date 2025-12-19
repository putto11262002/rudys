"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { ImageCapture } from "@/components/ui/image-capture";
import { AiActionButton } from "@/components/ai/ai-action-button";
import { DEFAULT_STATION_MODEL_ID } from "@/components/ai/model-selector";
import {
  useCreatePendingStation,
  useUploadStationImages,
  useExtractStation,
} from "@/hooks/stations";

interface StationCaptureFormProps {
  sessionId: string;
}

/**
 * Station capture form with two-phase upload pattern.
 *
 * Unlike loading lists which use streaming extraction in parent,
 * stations use simple mutation extraction directly here because:
 * - Station extraction is simple (single product code + quantities)
 * - No benefit from streaming UI for such small data
 * - Keeps the component self-contained
 */
export function StationCaptureForm({ sessionId }: StationCaptureFormProps) {
  const [signImage, setSignImage] = useState<File | null>(null);
  const [stockImage, setStockImage] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createPendingStation = useCreatePendingStation();
  const uploadStationImages = useUploadStationImages();
  const extractStation = useExtractStation();

  const handleSubmit = async (modelId: string) => {
    if (!signImage || !stockImage) {
      toast.error("Both sign and stock images are required");
      return;
    }

    setIsCreating(true);

    try {
      // Phase 1: Create station instantly (returns immediately)
      const result = await createPendingStation.mutateAsync({ sessionId });

      const stationId = result.station?.id;
      if (!stationId) {
        toast.error("Failed to create station");
        setIsCreating(false);
        return;
      }

      // Store images for background upload
      const signToUpload = signImage;
      const stockToUpload = stockImage;

      // Clear form immediately - ready for next capture
      setSignImage(null);
      setStockImage(null);
      setIsCreating(false);

      toast.success("Station created, uploading images...");

      // Phase 2: Upload images in background (non-blocking)
      // Capture modelId in closure - no ref needed
      void (async () => {
        try {
          // Upload images via client upload - returns blob URLs
          const result = await uploadStationImages.mutateAsync({
            stationId,
            sessionId,
            signImage: signToUpload,
            stockImage: stockToUpload,
          });

          // Upload complete - trigger extraction with URLs (no DB lookup needed)
          toast.success("Images uploaded, extracting...");

          extractStation.mutate(
            {
              id: stationId,
              sessionId,
              modelId,
              signImageUrl: result.signUrl,
              stockImageUrl: result.stockUrl,
            },
            {
              onSuccess: (extractionData) => {
                const status = extractionData.extraction?.status;
                if (status === "success") {
                  toast.success("Station extracted successfully");
                } else if (status === "warning") {
                  toast.warning(
                    extractionData.extraction?.message ||
                      "Station extracted with warnings"
                  );
                } else {
                  toast.error(
                    extractionData.extraction?.message ||
                      "Station extraction failed"
                  );
                }
              },
              onError: (error) => {
                toast.error(error.message);
              },
            }
          );
        } catch (error) {
          toast.error(
            `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      })();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create station"
      );
      setIsCreating(false);
    }
  };

  const isProcessing = isCreating || createPendingStation.isPending;

  return (
    <div className="space-y-4">
      {/* Upload button with model selector */}
      <div className="flex justify-start">
        <AiActionButton
          onAction={handleSubmit}
          disabled={isProcessing || !signImage || !stockImage}
          isLoading={isProcessing}
          label="Confirm & Extract"
          loadingLabel="Creating..."
          icon={<Upload className="size-4" />}
          defaultModel={DEFAULT_STATION_MODEL_ID}
        />
      </div>

      {/* Two stacked capture boxes */}
      <div className="space-y-3">
        <ImageCapture
          label="Station Sign"
          value={signImage}
          onChange={setSignImage}
          disabled={isProcessing}
          alt="Sign"
        />
        <ImageCapture
          label="Stock Photo"
          value={stockImage}
          onChange={setStockImage}
          disabled={isProcessing}
          alt="Stock"
        />
      </div>
    </div>
  );
}
