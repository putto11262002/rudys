import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/data/sessions";

interface LoadingListsPageProps {
  params: Promise<{ id: string }>;
}

export default async function LoadingListsPage({ params }: LoadingListsPageProps) {
  const { id } = await params;
  const session = await getSession(id);

  if (!session) {
    notFound();
  }

  return (
    <main className="container max-w-2xl mx-auto p-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/">
            <ArrowLeft className="size-4 mr-2" />
            Back to Sessions
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Loading Lists</h1>
        <p className="text-muted-foreground text-sm">
          Session started {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(session.createdAt))}
        </p>
      </div>

      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <p>Loading list capture will be implemented in T3.</p>
      </div>
    </main>
  );
}
