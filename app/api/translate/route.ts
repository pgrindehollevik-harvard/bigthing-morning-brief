import { NextResponse } from "next/server";
import { translateCaseContent } from "@/lib/translate";
import { DigestItem } from "@/types";

export async function POST(request: Request) {
  try {
    const { items, language } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }

    if (language === "no") {
      // Return original items for Norwegian
      return NextResponse.json({ items });
    }

    // Translate all items
    const translatedItems = await Promise.all(
      items.map((item: DigestItem) => 
        translateCaseContent(item, "en").then(translated => ({
          ...item,
          title: translated.title,
          summary: translated.summary,
          whyItMatters: translated.whyItMatters,
          tema: translated.tema,
        }))
      )
    );

    return NextResponse.json({ items: translatedItems });
  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json(
      { error: "Failed to translate content" },
      { status: 500 }
    );
  }
}

