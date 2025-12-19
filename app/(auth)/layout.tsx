import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";

// Force dynamic rendering - auth check must run on every request
export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = await validateSession();

  if (!isAuthenticated) {
    redirect("/sign-in");
  }

  return <>{children}</>;
}
