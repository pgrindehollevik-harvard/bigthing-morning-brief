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

    // Build rich context from cases (if any)
    const casesContext = cases.length > 0
      ? cases
          .map(
            (caseItem: DigestItem, index: number) => {
              let context = `
Sak ${index + 1}:
Tittel: ${caseItem.title}
Oppsummering: ${caseItem.summary}
Hvorfor viktig: ${caseItem.whyItMatters}
Tema: ${caseItem.tema || "Ikke spesifisert"}
Kilde: ${caseItem.source?.type === "regjering" ? caseItem.source.department : caseItem.source?.representatives?.map((r: any) => `${r.name} (${r.party})`).join(", ") || "Ukjent"}
URL: ${caseItem.url}
`;
              // Add any additional context if available in the original document
              // (This would come from the full StortingetDocument if we pass it through)
              return context;
            }
          )
          .join("\n---\n")
      : "Ingen saker er lagt til i kontekst ennå.";

    // Build conversation history
    const historyMessages = conversationHistory.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Check if user is asking for web search or news - be very aggressive
    const messageLower = message.toLowerCase();
    const searchKeywords = /(nyheter|news|søk|finn|hva skjer|oppdatert|recent|latest|nylig|siste|internett|avis|avisene|artikkel|artikler|google|nettet|nettside|nettsted|sanntid|realtid|oppdatert informasjon|nye saker|nye artikler)/i;
    
    // Check for explicit search requests
    const explicitSearch = searchKeywords.test(message) || 
                          messageLower.includes("finn nyheter") ||
                          messageLower.includes("søk etter") ||
                          messageLower.includes("søk om") ||
                          messageLower.includes("finn saker") ||
                          messageLower.includes("finn artikler") ||
                          messageLower.includes("hva skjer med") ||
                          messageLower.includes("nyheter om");
    
    // Also search if user asks about "disse sakene" with news/search context
    const shouldSearch = explicitSearch || 
                        (messageLower.includes("disse sakene") && (messageLower.includes("nyheter") || messageLower.includes("finn") || messageLower.includes("søk")));
    
    let webSearchResults = "";
    let webSearchAvailable = false;
    let searchDebugInfo = null;
    
    if (shouldSearch) {
      // Extract search terms from message and cases
      let searchTerms = "";
      if (cases.length > 0) {
        // Use case titles and temas for search
        searchTerms = cases.map((c: DigestItem) => {
          // Extract key terms from title (remove "Representantforslag om" etc.)
          const cleanTitle = c.title
            .replace(/^Representantforslag om /i, "")
            .replace(/^Proposisjon /i, "")
            .substring(0, 100); // Limit length
          return `${cleanTitle} ${c.tema || ""}`;
        }).join(" ");
      } else {
        searchTerms = message;
      }
      
      // Build search query
      const searchQuery = `${searchTerms} norge nyheter 2025`.trim();
      
      try {
        console.log("=".repeat(50));
        console.log("🔍 WEB SEARCH TRIGGERED");
        console.log("Original message:", message);
        console.log("Search query:", searchQuery);
        console.log("TAVILY_API_KEY exists:", !!process.env.TAVILY_API_KEY);
        console.log("TAVILY_API_KEY length:", process.env.TAVILY_API_KEY?.length || 0);
        
        const searchStartTime = Date.now();
        webSearchResults = await searchWeb(searchQuery, 5);
        const searchDuration = Date.now() - searchStartTime;
        
        webSearchAvailable = !!webSearchResults && 
                            webSearchResults.length > 0 && 
                            !webSearchResults.includes("[Web search ikke konfigurert") &&
                            !webSearchResults.includes("Web search ikke konfigurert");
        
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
        if (webSearchResults.length > 0) {
          console.log("Results preview:", webSearchResults.substring(0, 300));
        }
        console.log("=".repeat(50));
        
        if (webSearchResults && !webSearchAvailable) {
          console.log("⚠️ Web search returned configuration message or empty");
        } else if (webSearchResults && webSearchAvailable) {
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
        webSearchAvailable = false;
      }
    } else {
      console.log("ℹ️ Web search not triggered");
      console.log("  - Message:", message);
      console.log("  - Explicit search:", explicitSearch);
      console.log("  - Should search:", shouldSearch);
      searchDebugInfo = { triggered: false, reason: "No search keywords detected in message" };
    }

    // System prompt - Expert policy analyst tone
    let systemPrompt = `Du er en ekspert på norsk politikk, Stortinget og offentlig forvaltning. Du gir innsiktsfulle, profesjonelle analyser og briefs for politikere, beslutningstakere og interesserte borgere.

${cases.length > 0 ? `Brukeren har lagt til følgende saker i kontekst:\n${casesContext}` : "Brukeren har ikke lagt til noen saker ennå, men du kan hjelpe med generelle spørsmål om norsk politikk og Stortinget."}

KRITISK - KILDEBRUK OG SITATER:
- Du MÅ kun bruke informasjon fra sakene som er lagt til i kontekst over
- Du MÅ alltid sitere kildene når du refererer til informasjon fra sakene
- Bruk markdown-lenker for å sitere: [Kilde: Tittel](URL)
- SI ALDRI at du har brukt kilder du ikke har tilgang til
- SI ALDRI at du har brukt artikler, rapporter eller dokumenter som ikke er nevnt i konteksten
- Hvis du refererer til informasjon, må du alltid inkludere lenken til den aktuelle saken
- Når du svarer på spørsmål om kilder, list opp de faktiske URL-ene fra sakene i kontekst

Din rolle og ekspertise:
- Du er en politisk analytiker med dyp forståelse av norsk politikk, Stortingets prosesser og offentlig forvaltning
- Du gir konkrete, handlingsrettede innsikter - ikke generiske observasjoner
- Du identifiserer politiske sammenhenger, implikasjoner og konsekvenser
- Du forklarer komplekse saker på en tilgjengelig måte uten å miste nøyaktighet
- Du er objektiv og balansert, men ikke nøytral - du gir meningsfulle analyser

Din kommunikasjonsstil:
- Vær direkte, tydelig og informativ - som en erfaren kollega som gir en brief
- Unngå kundeservice-språk ("Jeg hjelper deg gjerne", "Hva kan jeg hjelpe med?")
- Start direkte med innholdet, ikke disclaimers eller unnskyldninger
- Bruk markdown for struktur (overskrifter, lister, **fet tekst** for viktige poeng)
- Når du analyserer saker, vær konkret: hva betyr dette? Hvem påvirkes? Hva er neste steg?
- Identifiser politiske dimensjoner: partipolitiske linjer, interessekonflikter, praktiske konsekvenser
- Alltid inkluder kildelenker nederst i svaret ditt som en "Kilder:"-seksjon`;

    // Add web search results if available
    if (webSearchAvailable && webSearchResults && webSearchResults.length > 50) {
      systemPrompt += `\n\nKRITISK VIKTIG - DU HAR NETTOPP SØKT PÅ INTERNETT:
Du HAR utført et web søk og har oppdaterte søkeresultater nedenfor. Dette er SANNTIDS informasjon fra internett.

ABSOLUTT FORBUDT:
- SI ALDRI "Jeg har ikke mulighet til å søke" - du har nettopp gjort det!
- SI ALDRI "Jeg kan ikke søke etter sanntidsnyheter" - du kan og har gjort det!
- SI ALDRI "Jeg anbefaler å bruke nyhetskilder" - du HAR allerede funnet nyheter!
- SI ALDRI at din kunnskap er fra oktober 2023 - du har fersk informasjon!

MÅ Gjøre:
- Start svaret med at du har funnet oppdatert informasjon
- Bruk søkeresultatene aktivt i svaret
- Referer til kildene med lenker fra søkeresultatene
- Presenter informasjonen som fersk og relevant
- Inkluder lenker fra både søkeresultatene OG sakene i kontekst

Web søkeresultater (OPPDATERT INFORMASJON):
${webSearchResults}

Bruk denne informasjonen for å gi et detaljert, oppdatert svar.`;
    } else if (shouldSearch && !webSearchAvailable) {
      // Even if search failed, don't let AI say it can't search
      systemPrompt += `\n\nMERK: Brukeren ba om web søk. Hvis søkeresultater mangler, baser deg på sakene i kontekst, men si IKKE at du ikke kan søke.`;
    }
    
    // Always add requirement to cite sources from cases
    if (cases.length > 0) {
      const caseUrls = cases.map((c: DigestItem) => `- [${c.title}](${c.url})`).join('\n');
      systemPrompt += `\n\nVIKTIG - KILDEHÅNDTERING:
Når du svarer, MÅ du alltid inkludere en "Kilder:"-seksjon nederst med lenker til sakene du har brukt:
${caseUrls}

Dette gjelder ALLTID, uavhengig av om du også har web søkeresultater.`;
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

