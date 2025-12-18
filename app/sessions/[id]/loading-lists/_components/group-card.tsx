import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { DeleteGroupButton } from "./delete-group-button";
import type { GroupWithImages } from "@/lib/data/groups";

interface GroupCardProps {
  group: GroupWithImages;
}

export function GroupCard({ group }: GroupCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {group.employeeLabel || `Group ${group.id.slice(0, 8)}`}
          <span className="text-sm font-normal text-muted-foreground">
            ({group.images.length} image{group.images.length !== 1 ? "s" : ""})
          </span>
        </CardTitle>
        <CardAction>
          <DeleteGroupButton groupId={group.id} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {group.images.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {group.images.map((image) => (
              <div
                key={image.id}
                className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden"
              >
                <Image
                  src={image.blobUrl}
                  alt="Loading list"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 25vw, 150px"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No images
          </p>
        )}
      </CardContent>
    </Card>
  );
}
