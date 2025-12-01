import { NextResponse } from "next/server";
import { fetchRecentDocuments } from "@/lib/stortinget";
import { summarizeDocuments } from "@/lib/openai";
import { DigestResponse } from "@/types";

// Simple in-memory cache (in production, use Redis or similar)
const cache = new Map<string, { data: DigestResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  try {
    // Check for force refresh parameter
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    
    // Use date-based cache key so it refreshes daily
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `digest-${today}`;
    const cached = cache.get(cacheKey);
    
    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch recent documents from Stortinget
    const documents = await fetchRecentDocuments();

    if (documents.length === 0) {
      const emptyResponse: DigestResponse = {
        date: new Date().toISOString().split("T")[0],
        items: [],
      };
      return NextResponse.json(emptyResponse, {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    // Summarize documents using OpenAI
    const items = await summarizeDocuments(documents);

    const response: DigestResponse = {
      date: new Date().toISOString().split("T")[0],
      items,
    };

    // Cache the response with date-based key
    cache.set(cacheKey, { data: response, timestamp: Date.now() });
    
    // Clean up old cache entries (keep only today and yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `digest-${yesterday.toISOString().split("T")[0]}`;
    for (const [key] of cache.entries()) {
      if (key !== cacheKey && key !== yesterdayKey) {
        cache.delete(key);
      }
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error in /api/digest:", error);
    return NextResponse.json(
      { error: "Failed to generate digest" },
      { status: 500 }
    );
  }
}

