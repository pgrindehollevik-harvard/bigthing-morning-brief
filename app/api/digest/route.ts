import { NextResponse } from "next/server";
import { fetchRecentDocuments } from "@/lib/stortinget";
import { summarizeDocuments } from "@/lib/openai";
import { DigestResponse, DigestItem } from "@/types";
import { storage } from "@/lib/storage";

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
      console.log('[Digest] Returning cached response');
      return NextResponse.json(cached.data, {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Cache": "HIT",
        },
      });
    }

    console.log('[Digest] Fetching documents (cache miss or refresh requested)');
    // Fetch recent documents from Stortinget
    const documents = await fetchRecentDocuments();
    console.log(`[Digest] Fetched ${documents.length} documents`);

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

    // Check storage for existing summaries
    const items: DigestItem[] = [];
    
    for (const doc of documents) {
      if (!doc.sakId) continue;
      
      // Try to get cached summary
      const cachedSummary = await storage.getSummary(doc.sakId);
      if (cachedSummary) {
        items.push(cachedSummary);
      } else {
        // Need to generate summary
        const summaries = await summarizeDocuments([doc]);
        if (summaries.length > 0) {
          const summary = summaries[0];
          items.push(summary);
          // Cache the summary
          await storage.saveSummary(doc.sakId, summary);
        }
      }
    }
    
    // If we still need to generate summaries (for new documents)
    const docsNeedingSummaries = documents.filter(doc => 
      doc.sakId && !items.find(item => {
        // Match by URL since that's what we have in DigestItem
        return item.url === doc.url;
      })
    );
    
    if (docsNeedingSummaries.length > 0) {
      const newSummaries = await summarizeDocuments(docsNeedingSummaries);
      for (let i = 0; i < newSummaries.length; i++) {
        const summary = newSummaries[i];
        const doc = docsNeedingSummaries[i];
        if (doc.sakId) {
          items.push(summary);
          await storage.saveSummary(doc.sakId, summary);
        }
      }
    }

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

