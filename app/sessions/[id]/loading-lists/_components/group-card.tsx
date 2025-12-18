"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { DeleteGroupButton } from "./delete-group-button";
import { ImageUploadButton } from "./image-upload-button";
import { SortableImageGrid } from "./sortable-image-grid";
import type { GroupWithImages } from "@/lib/data/groups";

interface GroupCardProps {
  group: GroupWithImages;
  sessionId: string;
}

export function GroupCard({ group, sessionId }: GroupCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{group.employeeLabel || `Group ${group.id.slice(0, 8)}`}</CardTitle>
        <CardAction>
          <DeleteGroupButton groupId={group.id} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <SortableImageGrid images={group.images} groupId={group.id} />
        <ImageUploadButton sessionId={sessionId} groupId={group.id} />
      </CardContent>
    </Card>
  );
}
