"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthCheck } from "@/hooks/auth";

const PUBLIC_PATHS = ["/sign-in"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, error } = useAuthCheck();

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isAuthenticated = data?.authenticated ?? false;

  useEffect(() => {
    if (isLoading) return;

    // If not authenticated and not on public path, redirect to sign-in
    if (!isAuthenticated && !isPublicPath) {
      router.replace("/sign-in");
    }

    // If authenticated and on sign-in page, redirect to home
    if (isAuthenticated && pathname === "/sign-in") {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, isPublicPath, pathname, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If not authenticated and not on public path, show loading (redirect happening)
  if (!isAuthenticated && !isPublicPath) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If authenticated and on sign-in, show loading (redirect happening)
  if (isAuthenticated && pathname === "/sign-in") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
