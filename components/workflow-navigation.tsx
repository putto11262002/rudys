"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavTarget {
  href: string;
  label: string;
}

interface WorkflowNavigationProps {
  prev: NavTarget | null;
  next: NavTarget | null;
}

export function WorkflowNavigation({ prev, next }: WorkflowNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
      <div className="container max-w-2xl mx-auto flex items-center justify-between gap-3">
        {prev ? (
          <Button asChild variant="outline">
            <Link href={prev.href}>
              {prev.href === "/" ? (
                <Home className="size-4 mr-2" />
              ) : (
                <ArrowLeft className="size-4 mr-2" />
              )}
              {prev.label}
            </Link>
          </Button>
        ) : (
          <div />
        )}

        {next ? (
          <Button asChild variant="secondary">
            <Link href={next.href}>
              {next.label}
              {next.href === "/" ? (
                <Home className="size-4 ml-2" />
              ) : (
                <ArrowRight className="size-4 ml-2" />
              )}
            </Link>
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
