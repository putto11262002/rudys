import { NextRequest, NextResponse } from "next/server";
import { cleanupOldSessions } from "@/lib/cleanup/session";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized cron job attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting session cleanup cron job...");

    const result = await cleanupOldSessions(ONE_WEEK_MS);

    console.log("Session cleanup completed:", {
      deletedSessions: result.deletedSessions,
      deletedBlobs: result.deletedBlobs,
      failedBlobs: result.failedBlobs,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Session cleanup cron job failed:", error);
    return NextResponse.json(
      {
        error: "Cleanup failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
