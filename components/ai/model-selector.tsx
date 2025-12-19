"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { OpenAIIcon, GoogleIcon } from "@/components/icons/brand-icons";
import {
  AVAILABLE_MODELS,
  DEFAULT_LOADING_LIST_MODEL,
  DEFAULT_STATION_MODEL,
  type Model,
} from "@/lib/ai/models";

// Re-export for backwards compatibility
export { AVAILABLE_MODELS, type Model };
export const DEFAULT_MODEL_ID = DEFAULT_LOADING_LIST_MODEL;
export const DEFAULT_STATION_MODEL_ID = DEFAULT_STATION_MODEL;

function ProviderIcon({ provider }: { provider: Model["provider"] }) {
  if (provider === "openai") {
    return <OpenAIIcon className="size-4" />;
  }
  return <GoogleIcon className="size-4" />;
}

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ModelSelector({
  value,
  onChange,
  disabled,
  className,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className="flex items-center gap-2 truncate whitespace-nowrap">
            {selectedModel && (
              <ProviderIcon provider={selectedModel.provider} />
            )}
            <span className="truncate">
              {selectedModel?.name ?? "Select model..."}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup heading="OpenAI">
              {AVAILABLE_MODELS.filter((m) => m.provider === "openai").map(
                (model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => {
                      onChange(model.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === model.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <OpenAIIcon className="mr-2 size-4" />
                    <span className="whitespace-nowrap">{model.name}</span>
                  </CommandItem>
                ),
              )}
            </CommandGroup>
            <CommandGroup heading="Google">
              {AVAILABLE_MODELS.filter((m) => m.provider === "google").map(
                (model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => {
                      onChange(model.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === model.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <GoogleIcon className="mr-2 size-4" />
                    <span className="whitespace-nowrap">{model.name}</span>
                  </CommandItem>
                ),
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
