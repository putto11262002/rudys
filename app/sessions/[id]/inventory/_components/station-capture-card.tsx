"use client";

import { useRef, useState } from "react";
import { Camera, Check, ChevronDown, ImageUp, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
} from "@/components/ai/model-selector";
import { OpenAIIcon, GoogleIcon } from "@/components/icons/brand-icons";
import { useCreateStation, useExtractStation } from "@/hooks/stations";
import {
  validateImageFile,
  fileToBase64,
  getImageDimensions,
} from "@/lib/utils/image";

interface LocalImage {
  file: File;
  preview: string;
}

interface StationCaptureCardProps {
  sessionId: string;
}

export function StationCaptureCard({ sessionId }: StationCaptureCardProps) {
  const [signImage, setSignImage] = useState<LocalImage | null>(null);
  const [stockImage, setStockImage] = useState<LocalImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);

  const signInputRef = useRef<HTMLInputElement>(null);
  const signCameraRef = useRef<HTMLInputElement>(null);
  const stockInputRef = useRef<HTMLInputElement>(null);
  const stockCameraRef = useRef<HTMLInputElement>(null);

  const createStation = useCreateStation();
  const extractStation = useExtractStation();

  const handleFileSelect = (
    files: FileList | null,
    type: "sign" | "stock"
  ) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    const preview = URL.createObjectURL(file);
    const image = { file, preview };

    if (type === "sign") {
      if (signImage) URL.revokeObjectURL(signImage.preview);
      setSignImage(image);
    } else {
      if (stockImage) URL.revokeObjectURL(stockImage.preview);
      setStockImage(image);
    }

    // Reset inputs
    if (signInputRef.current) signInputRef.current.value = "";
    if (signCameraRef.current) signCameraRef.current.value = "";
    if (stockInputRef.current) stockInputRef.current.value = "";
    if (stockCameraRef.current) stockCameraRef.current.value = "";
  };

  const removeImage = (type: "sign" | "stock") => {
    if (type === "sign" && signImage) {
      URL.revokeObjectURL(signImage.preview);
      setSignImage(null);
    } else if (type === "stock" && stockImage) {
      URL.revokeObjectURL(stockImage.preview);
      setStockImage(null);
    }
  };

  const handleSubmit = async () => {
    if (!signImage || !stockImage) {
      toast.error("Both sign and stock images are required");
      return;
    }

    setIsUploading(true);

    try {
      // Convert images to base64 with dimensions
      const [signData, stockData] = await Promise.all([
        Promise.all([
          fileToBase64(signImage.file),
          getImageDimensions(signImage.file),
        ]),
        Promise.all([
          fileToBase64(stockImage.file),
          getImageDimensions(stockImage.file),
        ]),
      ]);

      const signImageData = {
        name: signImage.file.name,
        type: signImage.file.type,
        base64: signData[0],
        width: signData[1].width,
        height: signData[1].height,
      };

      const stockImageData = {
        name: stockImage.file.name,
        type: stockImage.file.type,
        base64: stockData[0],
        width: stockData[1].width,
        height: stockData[1].height,
      };

      // Cleanup previews
      URL.revokeObjectURL(signImage.preview);
      URL.revokeObjectURL(stockImage.preview);

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
              { id: stationId, sessionId, modelId: selectedModel },
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
      {/* Hidden file inputs */}
        <input
          ref={signCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileSelect(e.target.files, "sign")}
          className="hidden"
          disabled={isProcessing}
        />
        <input
          ref={signInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFileSelect(e.target.files, "sign")}
          className="hidden"
          disabled={isProcessing}
        />
        <input
          ref={stockCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileSelect(e.target.files, "stock")}
          className="hidden"
          disabled={isProcessing}
        />
        <input
          ref={stockInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFileSelect(e.target.files, "stock")}
          className="hidden"
          disabled={isProcessing}
        />

      {/* Two stacked capture boxes */}
      <div className="space-y-3">
        {/* Sign Image */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Station Sign</p>
          {signImage ? (
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <img
                src={signImage.preview}
                alt="Sign"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage("sign")}
                disabled={isProcessing}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-background/90 hover:bg-background disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                <button
                  type="button"
                  onClick={() => signCameraRef.current?.click()}
                  disabled={isProcessing}
                  className="flex flex-col items-center justify-center gap-2 py-6 hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <Camera className="size-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Take Photo
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => signInputRef.current?.click()}
                  disabled={isProcessing}
                  className="flex flex-col items-center justify-center gap-2 py-6 hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <ImageUp className="size-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Upload
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stock Image */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Stock Photo</p>
          {stockImage ? (
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <img
                src={stockImage.preview}
                alt="Stock"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage("stock")}
                disabled={isProcessing}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-background/90 hover:bg-background disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                <button
                  type="button"
                  onClick={() => stockCameraRef.current?.click()}
                  disabled={isProcessing}
                  className="flex flex-col items-center justify-center gap-2 py-6 hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <Camera className="size-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Take Photo
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => stockInputRef.current?.click()}
                  disabled={isProcessing}
                  className="flex flex-col items-center justify-center gap-2 py-6 hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <ImageUp className="size-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Upload
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload button with model selector */}
      <ButtonGroup className="w-full">
        <Button
          variant="outline"
          onClick={handleSubmit}
          disabled={isProcessing || !signImage || !stockImage}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              Confirm & Extract
            </>
          )}
        </Button>
        <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isProcessing || !signImage || !stockImage}
              aria-label="Select AI model"
              className="max-w-32 gap-1.5 px-2"
            >
              {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.provider ===
              "openai" ? (
                <OpenAIIcon className="size-4 shrink-0" />
              ) : (
                <GoogleIcon className="size-4 shrink-0" />
              )}
              <span className="truncate">
                {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name}
              </span>
              <ChevronDown className="size-4 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="end">
            <Command>
              <CommandList>
                <CommandGroup heading="OpenAI">
                  {AVAILABLE_MODELS.filter((m) => m.provider === "openai").map(
                    (model) => (
                      <CommandItem
                        key={model.id}
                        value={model.id}
                        onSelect={() => {
                          setSelectedModel(model.id);
                          setModelPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            selectedModel === model.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <OpenAIIcon className="mr-2 size-4" />
                        <span className="whitespace-nowrap">{model.name}</span>
                      </CommandItem>
                    )
                  )}
                </CommandGroup>
                <CommandGroup heading="Google">
                  {AVAILABLE_MODELS.filter((m) => m.provider === "google").map(
                    (model) => (
                      <CommandItem
                        key={model.id}
                        value={model.id}
                        onSelect={() => {
                          setSelectedModel(model.id);
                          setModelPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            selectedModel === model.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <GoogleIcon className="mr-2 size-4" />
                        <span className="whitespace-nowrap">{model.name}</span>
                      </CommandItem>
                    )
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </ButtonGroup>
    </div>
  );
}
