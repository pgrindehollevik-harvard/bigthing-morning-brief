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
    // Also trigger search if user asks about news, articles, or if they explicitly mention searching
    const searchKeywords = /(nyheter|news|søk|finn|hva skjer|oppdatert|recent|latest|nylig|siste|internett|avis|avisene|artikkel|artikler|google|nettet|nettside|nettsted)/i;
    const needsWebSearch = searchKeywords.test(message) || 
                          message.toLowerCase().includes("søk") ||
                          message.toLowerCase().includes("search") ||
                          message.toLowerCase().includes("nyheter");
    
    // ALWAYS try to search if:
    // 1. User explicitly asks for search/news
    // 2. User asks about cases and we have cases in context (likely wants updated info)
    // 3. Message is a question about the cases
    const isQuestion = message.trim().endsWith("?");
    const shouldSearch = needsWebSearch || 
                        (cases.length > 0 && (isQuestion || /(hva|what|om|about|informasjon|information|kan|can)/i.test(message)));
    
    let webSearchResults = "";
    let webSearchAvailable = false;
    let searchDebugInfo = null;
    
    if (shouldSearch) {
      // Extract search terms from message and cases
      const searchTerms = cases.length > 0
        ? cases.map((c: DigestItem) => `${c.title} ${c.tema || ""}`).join(" ")
        : message;
      
      try {
        const searchQuery = cases.length > 0 
          ? `${searchTerms} norge nyheter`
          : `${message} norge nyheter`;
        
        console.log("=".repeat(50));
        console.log("🔍 WEB SEARCH TRIGGERED");
        console.log("Query:", searchQuery);
        console.log("TAVILY_API_KEY exists:", !!process.env.TAVILY_API_KEY);
        console.log("TAVILY_API_KEY length:", process.env.TAVILY_API_KEY?.length || 0);
        
        const searchStartTime = Date.now();
        webSearchResults = await searchWeb(searchQuery, 5);
        const searchDuration = Date.now() - searchStartTime;
        
        webSearchAvailable = !!webSearchResults && !webSearchResults.includes("[Web search ikke konfigurert");
        
        searchDebugInfo = {
          triggered: true,
          query: searchQuery,
          duration: `${searchDuration}ms`,
          hasResults: !!webSearchResults,
          resultsLength: webSearchResults.length,
          available: webSearchAvailable,
          preview: webSearchResults.substring(0, 200) + (webSearchResults.length > 200 ? "..." : ""),
        };
        
        console.log("Search completed in", searchDuration, "ms");
        console.log("Results available:", webSearchAvailable);
        console.log("Results length:", webSearchResults.length);
        console.log("Results preview:", webSearchResults.substring(0, 300));
        console.log("=".repeat(50));
        
        if (webSearchResults && !webSearchAvailable) {
          console.log("⚠️ Web search returned configuration message");
        } else if (webSearchResults) {
          console.log("✅ Web search successful!");
        } else {
          console.log("❌ Web search returned empty results");
        }
      } catch (error) {
        console.error("❌ Web search error:", error);
        searchDebugInfo = {
          triggered: true,
          error: error instanceof Error ? error.message : String(error),
        };
        webSearchResults = "";
      }
    } else {
      console.log("ℹ️ Web search not triggered (no keywords detected)");
      searchDebugInfo = { triggered: false, reason: "No search keywords in message" };
    }

    // System prompt - Natural, conversational tone
    let systemPrompt = `Du er en kunnskapsrik og engasjert assistent som hjelper med å forstå norsk politikk og Stortinget. Du kommuniserer på en naturlig, vennlig og profesjonell måte - som en kollega som har god oversikt over politikk, ikke som en kundeservicemedarbeider.

${cases.length > 0 ? `Brukeren har lagt til følgende saker i kontekst:\n${casesContext}` : "Brukeren har ikke lagt til noen saker ennå, men du kan hjelpe med generelle spørsmål om norsk politikk og Stortinget."}

Din kommunikasjonsstil:
- Vær naturlig og samtaleaktig, ikke formell eller robotaktig
- Bruk en vennlig, profesjonell tone - som du snakker med en kollega
- Vær direkte og tydelig, men ikke stiv eller korporativ
- Når du refererer til sakene, vær konkret og relevant
- Unngå generiske fraser som "Jeg hjelper deg gjerne" eller "Hva kan jeg hjelpe deg med?"
- Start direkte med svaret, ikke med unnskyldninger eller disclaimers
- Bruk markdown for å strukturere lange svar (overskrifter, lister, fet tekst for viktige poeng)`;

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
    } else if (shouldSearch && !webSearchAvailable) {
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

    // Include debug info in development
    const debugInfo = process.env.NODE_ENV === "development" ? {
      search: searchDebugInfo,
      needsWebSearch,
      shouldSearch,
      webSearchAvailable,
      webSearchResultsLength: webSearchResults.length,
      hasApiKey: !!process.env.TAVILY_API_KEY,
    } : undefined;

    return NextResponse.json({ 
      response,
      ...(debugInfo && { _debug: debugInfo }),
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

