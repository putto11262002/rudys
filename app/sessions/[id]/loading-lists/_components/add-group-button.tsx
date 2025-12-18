"use client";

import { useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createEmployeeGroup } from "@/lib/actions/groups";

interface AddGroupButtonProps {
  sessionId: string;
}

export function AddGroupButton({ sessionId }: AddGroupButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createEmployeeGroup(sessionId);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="size-4 mr-2 animate-spin" />
          Adding...
        </>
      ) : (
        <>
          <Plus className="size-4 mr-2" />
          Add Employee Group
        </>
      )}
    </Button>
  );
}
