import { NextResponse } from "next/server";
import { fetchRecentDocuments } from "@/lib/stortinget";
import { summarizeDocuments } from "@/lib/openai";
import { DigestResponse } from "@/types";

export async function GET() {
  try {
    // Fetch recent documents from Stortinget
    const documents = await fetchRecentDocuments();

    if (documents.length === 0) {
      return NextResponse.json(
        {
          date: new Date().toISOString().split("T")[0],
          items: [],
        } as DigestResponse,
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Summarize documents using OpenAI
    const items = await summarizeDocuments(documents);

    const response: DigestResponse = {
      date: new Date().toISOString().split("T")[0],
      items,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
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

