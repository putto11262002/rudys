"use client";

import { useState } from "react";
import {
  Loader2,
  MoreVertical,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteGroup } from "@/hooks/groups";

interface GroupActionsMenuProps {
  groupId: string;
  sessionId: string;
  onRerunExtraction: () => void;
  isExtracting?: boolean;
}

export function GroupActionsMenu({
  groupId,
  sessionId,
  onRerunExtraction,
  isExtracting = false,
}: GroupActionsMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteGroup = useDeleteGroup();

  const handleDelete = () => {
    deleteGroup.mutate(
      { id: groupId, sessionId },
      {
        onSuccess: () => {
          toast.success("Group deleted");
          setDeleteDialogOpen(false);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  const handleRerun = () => {
    onRerunExtraction();
  };

  return (
    <>
      {/* Desktop: separate buttons */}
      <div className="hidden md:flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRerun}
          disabled={isExtracting}
          title="Re-run extraction"
        >
          <RefreshCw className={`size-4 ${isExtracting ? "animate-spin" : ""}`} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={deleteGroup.isPending}
          title="Delete group"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Mobile: dropdown menu */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleRerun}
              disabled={isExtracting}
            >
              <RefreshCw className={`size-4 mr-2 ${isExtracting ? "animate-spin" : ""}`} />
              Re-run extraction
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Delete group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this group and all its images. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGroup.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteGroup.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGroup.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
