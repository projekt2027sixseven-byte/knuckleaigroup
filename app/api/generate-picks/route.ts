import { NextResponse } from "next/server";
import { runDailyGeneration } from "@/lib/generatePicks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/generate-picks
 * Fetches today's matches, scores them, keeps top 10, saves to database.
 * Returns JSON: { success, message, picksCount?, error? }
 */
export async function GET() {
  try {
    const result = await runDailyGeneration();
    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        picksCount: result.picksCount,
        error: result.error,
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        message: "Generation failed",
        error: message,
      },
      { status: 500 }
    );
  }
}
