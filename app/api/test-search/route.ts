import { NextResponse } from "next/server";
import { searchWeb } from "@/lib/webSearch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "statsbudsjett 2025 norge";

  try {
    console.log("🧪 TEST SEARCH - Query:", query);
    console.log("TAVILY_API_KEY exists:", !!process.env.TAVILY_API_KEY);
    console.log("TAVILY_API_KEY length:", process.env.TAVILY_API_KEY?.length || 0);
    
    const startTime = Date.now();
    const results = await searchWeb(query, 5);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      query,
      hasApiKey: !!process.env.TAVILY_API_KEY,
      duration: `${duration}ms`,
      resultsLength: results.length,
      results: results,
      preview: results.substring(0, 500),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      hasApiKey: !!process.env.TAVILY_API_KEY,
    }, { status: 500 });
  }
}

