"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { ImageCapture } from "@/components/ui/image-capture";
import { AiActionButton } from "@/components/ai/ai-action-button";
import { useCreateStation, useExtractStation } from "@/hooks/stations";
import { fileToBase64, getImageDimensions } from "@/lib/utils/image";

interface StationCaptureFormProps {
  sessionId: string;
}

export function StationCaptureForm({ sessionId }: StationCaptureFormProps) {
  const [signImage, setSignImage] = useState<File | null>(null);
  const [stockImage, setStockImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const createStation = useCreateStation();
  const extractStation = useExtractStation();

  const handleSubmit = async (modelId: string) => {
    if (!signImage || !stockImage) {
      toast.error("Both sign and stock images are required");
      return;
    }

    setIsUploading(true);

    try {
      // Convert images to base64 with dimensions
      const [signData, stockData] = await Promise.all([
        Promise.all([fileToBase64(signImage), getImageDimensions(signImage)]),
        Promise.all([fileToBase64(stockImage), getImageDimensions(stockImage)]),
      ]);

      const signImageData = {
        name: signImage.name,
        type: signImage.type,
        base64: signData[0],
        width: signData[1].width,
        height: signData[1].height,
      };

      const stockImageData = {
        name: stockImage.name,
        type: stockImage.type,
        base64: stockData[0],
        width: stockData[1].width,
        height: stockData[1].height,
      };

      // Create station
      createStation.mutate(
        {
          sessionId,
          signImage: signImageData,
          stockImage: stockImageData,
        },
        {
          onSuccess: (data) => {
            const stationId = data.station?.id;
            if (!stationId) {
              toast.error("Failed to create station");
              setIsUploading(false);
              return;
            }

            // Clear form immediately - ready for next capture
            setSignImage(null);
            setStockImage(null);
            setIsUploading(false);

            toast.success("Station uploaded, extraction running...");

            // Trigger extraction async (don't block UI)
            extractStation.mutate(
              { id: stationId, sessionId, modelId },
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
          },
          onError: (error) => {
            toast.error(error.message);
            setIsUploading(false);
          },
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process images"
      );
      setIsUploading(false);
    }
  };

  // Only block UI during upload, extraction runs async
  const isProcessing = isUploading || createStation.isPending;

  return (
    <div className="space-y-4">
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

      {/* Upload button with model selector */}
      <div className="flex justify-start">
        <AiActionButton
          onAction={handleSubmit}
          disabled={isProcessing || !signImage || !stockImage}
          isLoading={isProcessing}
          label="Confirm & Extract"
          loadingLabel="Uploading..."
          icon={<Upload className="size-4" />}
        />
      </div>
    </div>
  );
}
