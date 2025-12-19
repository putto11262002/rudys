"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDeleteSession } from "@/hooks/sessions";

interface DeleteSessionButtonProps {
  sessionId: string;
}

export function DeleteSessionButton({ sessionId }: DeleteSessionButtonProps) {
  const [open, setOpen] = useState(false);
  const deleteSession = useDeleteSession();

  const handleDelete = () => {
    deleteSession.mutate(sessionId, {
      onSuccess: () => {
        toast.success("Session deleted");
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="size-4 mr-1" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete session?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this session and all associated images.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteSession.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteSession.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteSession.isPending ? (
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
  );
}
