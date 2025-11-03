import { NextResponse } from "next/server";
import { scrapeQuantGuideProblems } from "@/src/lib/scraper";

export const dynamic = "force-dynamic";

// Simple API endpoint to kick off the scraping process
// Just hit GET /api/scrape and it'll do its thing
export async function GET() {
  try {
    const problems = await scrapeQuantGuideProblems();

    return NextResponse.json(
      {
        success: true,
        count: problems.length,
        problems,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}






