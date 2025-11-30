import { NextResponse } from "next/server";
import OpenAI from "openai";
import { DigestItem } from "@/types";
import { searchWeb } from "@/lib/webSearch";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const { message, cases = [], conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Build context from cases (if any)
    const casesContext = cases.length > 0
      ? cases
          .map(
            (caseItem: DigestItem, index: number) => `
Sak ${index + 1}:
Tittel: ${caseItem.title}
Oppsummering: ${caseItem.summary}
Hvorfor viktig: ${caseItem.whyItMatters}
Tema: ${caseItem.tema || "Ikke spesifisert"}
Kilde: ${caseItem.source?.type === "regjering" ? caseItem.source.department : caseItem.source?.representatives?.map((r: any) => `${r.name} (${r.party})`).join(", ") || "Ukjent"}
URL: ${caseItem.url}
`
          )
          .join("\n---\n")
      : "Ingen saker er lagt til i kontekst ennå.";

    // Build conversation history
    const historyMessages = conversationHistory.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Check if user is asking for web search or news
    const needsWebSearch = /(nyheter|news|søk|finn|hva skjer|oppdatert|recent|latest|nylig|siste)/i.test(message);
    
    let webSearchResults = "";
    if (needsWebSearch) {
      // Extract search terms from message and cases
      const searchTerms = cases
        .map((c: DigestItem) => `${c.title} ${c.tema || ""}`)
        .join(" ");
      
      try {
        const searchQuery = `${searchTerms} norge nyheter`;
        webSearchResults = await searchWeb(searchQuery, 5);
      } catch (error) {
        console.error("Web search error:", error);
        webSearchResults = "";
      }
    }

    // System prompt
    const systemPrompt = `Du er en ekspert på norsk politikk og Stortinget. Du hjelper brukere med å analysere og forstå saker fra Stortinget.

${cases.length > 0 ? `Du har tilgang til følgende saker i kontekst:\n${casesContext}` : "Ingen saker er lagt til i kontekst ennå. Du kan hjelpe med generelle spørsmål om norsk politikk og Stortinget."}

${webSearchResults ? `\nWeb søkeresultater:\n${webSearchResults}\n` : ""}

VIKTIG:
- Svar alltid på norsk
- Vær presis og faktabasert
- Hvis brukeren spør om nyheter eller oppdatert informasjon, bruk web søkeresultatene hvis tilgjengelig
- Du kan analysere sammenhenger mellom sakene
- Du kan diskutere implikasjoner og konsekvenser
- Vær objektiv og balansert i dine analyser
- Hvis du ikke har oppdatert informasjon, kan du anbefale at brukeren søker etter nyere nyheter`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || "Beklager, jeg kunne ikke generere et svar.";

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

