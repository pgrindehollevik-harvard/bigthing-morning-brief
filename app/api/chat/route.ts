import { NextResponse } from "next/server";
import OpenAI from "openai";
import { DigestItem } from "@/types";
import { searchWeb } from "@/lib/webSearch";
import { storage } from "@/lib/storage";
import { getRelevantPdfChunks } from "@/lib/pdfHandler";

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
    // Fetch full documents from storage for enhanced context
    const casesContext = cases.length > 0
      ? await Promise.all(
          cases.map(async (caseItem: DigestItem, index: number) => {
            // Extract sakId from URL or try to find it
            let sakId: string | undefined;
            try {
              // URL format: https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=104870
              const urlMatch = caseItem.url.match(/[?&]p=(\d+)/);
              if (urlMatch) {
                sakId = urlMatch[1];
              }
            } catch (e) {
              // Ignore
            }
            
            // Fetch full document from storage
            const fullDoc = sakId ? await storage.getDocument(sakId) : null;
            
            let context = `
Sak ${index + 1}:
Tittel: ${caseItem.title}
Oppsummering: ${caseItem.summary}
Hvorfor viktig: ${caseItem.whyItMatters}
Tema: ${caseItem.tema || fullDoc?.tema || "Ikke spesifisert"}
Kilde: ${caseItem.source?.type === "regjering" ? caseItem.source.department : caseItem.source?.representatives?.map((r: any) => `${r.name} (${r.party})`).join(", ") || "Ukjent"}
URL: ${caseItem.url}
`;
            
            // Add full document context if available - structured for better AI understanding
            if (fullDoc) {
              context += `\n=== DETALJERT INFORMASJON ===\n`;
              
              // Administrative info
              if (fullDoc.departement) {
                context += `Fra: ${fullDoc.departement}\n`;
              }
              if (fullDoc.status) {
                context += `Status: ${fullDoc.status}\n`;
              }
              if (fullDoc.komite) {
                context += `Komité: ${fullDoc.komite}\n`;
              }
              if (fullDoc.dokumentgruppe) {
                context += `Dokumenttype: ${fullDoc.dokumentgruppe}\n`;
              }
              if (fullDoc.henvisning) {
                context += `Henvisning: ${fullDoc.henvisning}\n`;
              }
              
              // Who proposed it
              if (fullDoc.forslagstiller_liste && fullDoc.forslagstiller_liste.length > 0) {
                const proposers = fullDoc.forslagstiller_liste.map(r => {
                  const name = `${r.fornavn} ${r.etternavn}`;
                  const party = r.parti?.navn || '';
                  return party ? `${name} (${party})` : name;
                }).join(', ');
                context += `Forslagstiller(e): ${proposers}\n`;
              }
              
              // Process timeline
              if (fullDoc.saksgang && fullDoc.saksgang.length > 0) {
                context += `\n--- Saksgang ---\n`;
                fullDoc.saksgang.forEach(sg => {
                  context += `• ${sg.steg}`;
                  if (sg.dato) context += ` (${sg.dato})`;
                  if (sg.komite) context += ` - ${sg.komite}`;
                  if (sg.beskrivelse) context += `: ${sg.beskrivelse}`;
                  context += `\n`;
                });
              }
              
              // Basis for the case (grunnlag) - very important context
              if (fullDoc.grunnlag && fullDoc.grunnlag.trim().length > 0) {
                const grunnlagText = fullDoc.grunnlag.length > 3000 
                  ? fullDoc.grunnlag.substring(0, 3000) + '...' 
                  : fullDoc.grunnlag;
                context += `\n--- Grunnlag for saken ---\n${grunnlagText}\n`;
              }
              
              // Meeting minutes/reports (referat) - important context
              if (fullDoc.referat && fullDoc.referat.trim().length > 0) {
                const referatText = fullDoc.referat.length > 2000 
                  ? fullDoc.referat.substring(0, 2000) + '...' 
                  : fullDoc.referat;
                context += `\n--- Referat ---\n${referatText}\n`;
              }
              
              // Committee recommendation
              if (fullDoc.innstillingstekst && fullDoc.innstillingstekst.trim().length > 0) {
                const innstillingText = fullDoc.innstillingstekst.length > 2000 
                  ? fullDoc.innstillingstekst.substring(0, 2000) + '...' 
                  : fullDoc.innstillingstekst;
                context += `\n--- Komitéens innstilling ---\n${innstillingText}\n`;
              }
              
              // Full text - prioritize this but be smart about length
              if (fullDoc.fullText && fullDoc.fullText.trim().length > 0) {
                // If we have grunnlag/referat, use less of fullText to avoid redundancy
                const hasOtherContext = fullDoc.grunnlag || fullDoc.referat || fullDoc.innstillingstekst;
                const maxLength = hasOtherContext ? 3000 : 5000;
                const fullTextExcerpt = fullDoc.fullText.length > maxLength 
                  ? fullDoc.fullText.substring(0, maxLength) + '...' 
                  : fullDoc.fullText;
                context += `\n--- Full tekst (utdrag) ---\n${fullTextExcerpt}\n`;
              }
              
              // Add relevant PDF chunks if available
              if (fullDoc.publikasjon_referanser && fullDoc.publikasjon_referanser.length > 0) {
                const eksportIds = fullDoc.publikasjon_referanser
                  .filter(p => p.eksport_id)
                  .map(p => p.eksport_id!)
                  .slice(0, 3); // Limit to first 3 PDFs to avoid token limits
                
                if (eksportIds.length > 0) {
                  const pdfChunks = await getRelevantPdfChunks(eksportIds, message);
                  if (pdfChunks.length > 0) {
                    context += `\n--- Relevante utdrag fra vedlagte dokumenter ---\n`;
                    pdfChunks.slice(0, 3).forEach((chunk, idx) => {
                      context += `\n[Dokument ${idx + 1}]\n${chunk}\n`;
                    });
                  }
                }
              }
            }
            
            return context;
          })
        )
          .then(contexts => contexts.join("\n---\n"))
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
- Alltid inkluder kildelenker nederst i svaret ditt som en "Kilder:"-seksjon

VIKTIG - HVORDAN DU BRUKER KONTEKSTEN:
- Bruk ALL informasjon som er tilgjengelig i konteksten: grunnlag, referat, innstillingstekst, full tekst, og PDF-utdrag
- Når du svarer på spørsmål, ekstraher spesifikke detaljer fra dokumentene - ikke bare generelle beskrivelser
- Hvis brukeren spør om "hovedpunkter", "konsekvenser", "neste steg" - bruk informasjonen fra saksgang, innstilling og referat
- Bruk tall, datoer, navn og konkrete fakta fra dokumentene når de er tilgjengelige
- Hvis grunnlag eller referat inneholder viktig informasjon, inkluder den i svaret ditt
- Strukturer svaret med tydelige overskrifter når det er relevant (f.eks. "Hovedpunkter", "Konsekvenser", "Neste steg")

KRITISK - IKKE VÆR GENERISK:
- Hvis dokumentet inneholder spesifikke beløp, prosenter, eller tall - bruk dem!
- Hvis dokumentet nevner konkrete tiltak, reformer, eller endringer - list dem opp
- Hvis dokumentet beskriver spesifikke konsekvenser eller implikasjoner - referer til dem direkte
- Hvis dokumentet ikke inneholder nok informasjon til å svare spesifikt, si det tydelig og bruk det som er tilgjengelig
- Unngå generiske beskrivelser som "betydelige investeringer" - bruk konkrete tall eller si at spesifikke tall ikke er tilgjengelige
- Når du lister opp punkter, baser dem på faktisk innhold fra dokumentene, ikke generiske kategorier`;

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
      temperature: 0.5, // Lower temperature for more factual, focused responses
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

