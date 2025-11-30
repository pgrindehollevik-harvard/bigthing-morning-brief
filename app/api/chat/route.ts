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
    const needsWebSearch = /(nyheter|news|søk|finn|hva skjer|oppdatert|recent|latest|nylig|siste|internett|avis|avisene)/i.test(message);
    
    let webSearchResults = "";
    let webSearchAvailable = false;
    
    if (needsWebSearch) {
      // Extract search terms from message and cases
      const searchTerms = cases.length > 0
        ? cases.map((c: DigestItem) => `${c.title} ${c.tema || ""}`).join(" ")
        : message;
      
      try {
        const searchQuery = cases.length > 0 
          ? `${searchTerms} norge nyheter`
          : `${message} norge nyheter`;
        
        console.log("Attempting web search with query:", searchQuery);
        webSearchResults = await searchWeb(searchQuery, 5);
        webSearchAvailable = !!webSearchResults && !webSearchResults.includes("[Web search ikke konfigurert");
        
        if (webSearchResults && !webSearchAvailable) {
          console.log("Web search returned configuration message");
        } else if (webSearchResults) {
          console.log("Web search successful, results length:", webSearchResults.length);
        } else {
          console.log("Web search returned empty results");
        }
      } catch (error) {
        console.error("Web search error:", error);
        webSearchResults = "";
      }
    }

    // System prompt
    let systemPrompt = `Du er en ekspert på norsk politikk og Stortinget. Du hjelper brukere med å analysere og forstå saker fra Stortinget.

${cases.length > 0 ? `Du har tilgang til følgende saker i kontekst:\n${casesContext}` : "Ingen saker er lagt til i kontekst ennå. Du kan hjelpe med generelle spørsmål om norsk politikk og Stortinget."}

VIKTIG:
- Svar alltid på norsk
- Vær presis og faktabasert
- Du kan analysere sammenhenger mellom sakene
- Du kan diskutere implikasjoner og konsekvenser
- Vær objektiv og balansert i dine analyser`;

    // Add web search results if available
    if (webSearchAvailable && webSearchResults) {
      systemPrompt += `\n\nKRITISK VIKTIG - DU HAR TILGANG TIL WEB SØK:
Du HAR nettopp utført en web søk og har oppdaterte søkeresultater nedenfor. Dette er SANNTIDS informasjon fra internett.

VIKTIGE REGLER:
1. SI ALDRI at du ikke kan søke på internett - du kan og har nettopp gjort det!
2. SI ALDRI at du ikke har tilgang til oppdatert informasjon - du har det nedenfor!
3. SI ALDRI at din kunnskap er fra oktober 2023 - du har fersk informasjon fra søket!
4. BRUK søkeresultatene aktivt i svaret ditt
5. REFERER til kildene med lenker
6. PRESENTER informasjonen som om du nettopp fant den (fordi du gjorde det!)

Web søkeresultater (FRESK INFORMASJON):
${webSearchResults}

Når du svarer, start med å si at du har funnet oppdatert informasjon, og bruk deretter søkeresultatene for å gi et detaljert svar.`;
    } else if (needsWebSearch && !webSearchAvailable) {
      systemPrompt += `\n\nMERK: Brukeren ba om web søk, men søkeresultater er ikke tilgjengelig. Fortell brukeren at du baserer deg på sakene i kontekst.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o for fresher responses (released April 2024, updated regularly)
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

