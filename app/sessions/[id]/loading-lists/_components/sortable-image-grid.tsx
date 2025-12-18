"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { reorderImages } from "@/lib/actions/images";
import { DeleteImageButton } from "./delete-image-button";
import type { LoadingListImage } from "@/lib/db/schema";

interface SortableImageGridProps {
  images: LoadingListImage[];
  groupId: string;
}

interface SortableImageProps {
  image: LoadingListImage;
  index: number;
}

function SortableImage({ image, index }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-[3/4] bg-muted rounded-lg overflow-hidden"
    >
      <Image
        src={image.blobUrl}
        alt={`Loading list image ${index + 1}`}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 33vw, 150px"
      />

      {/* Order badge */}
      <Badge
        variant="secondary"
        className="absolute top-1 left-1 size-6 p-0 flex items-center justify-center text-xs"
      >
        {index + 1}
      </Badge>

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute bottom-1 left-1 p-1 rounded bg-background/80 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
      >
        <GripVertical className="size-4" />
      </div>

      {/* Delete button */}
      <DeleteImageButton imageId={image.id} />
    </div>
  );
}

export function SortableImageGrid({
  images: initialImages,
  groupId,
}: SortableImageGridProps) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);

      // Optimistic update
      const newImages = arrayMove(images, oldIndex, newIndex);
      setImages(newImages);

      // Save to server
      const orderedIds = newImages.map((img) => img.id);
      const result = await reorderImages(groupId, orderedIds);

      if (result.ok) {
        router.refresh();
      } else {
        // Revert on error
        setImages(images);
        toast.error(result.error);
      }
    }
  };

  if (images.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No images yet. Use the buttons above to capture or upload images.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={images.map((img) => img.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-3 gap-2">
          {images.map((image, index) => (
            <SortableImage key={image.id} image={image} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
