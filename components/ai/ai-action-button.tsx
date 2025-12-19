"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
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
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from "./model-selector";
import { OpenAIIcon, GoogleIcon } from "@/components/icons/brand-icons";

interface AiActionButtonProps {
  /** Callback when action is triggered, receives selected model ID */
  onAction: (modelId: string) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the action is currently loading */
  isLoading?: boolean;
  /** Label for the action button (default: "Confirm & Extract") */
  label?: string;
  /** Label shown when loading (default: "Processing...") */
  loadingLabel?: string;
  /** Icon to show on the action button */
  icon?: React.ReactNode;
  /** Initial model ID (default: DEFAULT_MODEL_ID) */
  defaultModel?: string;
  /** Controlled model value */
  model?: string;
  /** Callback when model changes (for controlled mode) */
  onModelChange?: (modelId: string) => void;
}

export function AiActionButton({
  onAction,
  disabled = false,
  isLoading = false,
  label = "Confirm & Extract",
  loadingLabel = "Processing...",
  icon,
  defaultModel = DEFAULT_MODEL_ID,
  model: controlledModel,
  onModelChange,
}: AiActionButtonProps) {
  const [internalModel, setInternalModel] = useState(defaultModel);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const selectedModel = controlledModel ?? internalModel;
  const setSelectedModel = (modelId: string) => {
    if (onModelChange) {
      onModelChange(modelId);
    } else {
      setInternalModel(modelId);
    }
  };

  const handleAction = () => {
    onAction(selectedModel);
  };

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
  const isDisabled = disabled || isLoading;

  return (
    <ButtonGroup className="max-w-full">
      <Button onClick={handleAction} disabled={isDisabled}>
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          <>
            {icon}
            {label}
          </>
        )}
      </Button>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            disabled={isDisabled}
            aria-label="Select AI model"
            className="gap-2 min-w-0"
          >
            {currentModel ? (
              <>
                {currentModel.provider === "openai" ? (
                  <OpenAIIcon className="size-4 shrink-0" />
                ) : (
                  <GoogleIcon className="size-4 shrink-0" />
                )}
                <span className="truncate">{currentModel.name}</span>
              </>
            ) : (
              <span className="truncate">Select model</span>
            )}
            <ChevronDown className="size-4 opacity-50 shrink-0" />
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
                        setPopoverOpen(false);
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
                        setPopoverOpen(false);
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
  );
}
