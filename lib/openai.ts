import OpenAI from "openai";
import { StortingetDocument, DigestItem } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPT_TEMPLATE = `
Du er en ekspert på norsk politikk og Stortinget. Din oppgave er å lage profesjonelle, innsiktsfulle oppsummeringer for politikere, beslutningstakere og interesserte borgere.

For hvert dokument skal du:
1. Lage en kort, men informativ oppsummering (2–4 setninger) som fanger essensen
2. Identifisere 1–2 konkrete punkter om "Hvorfor dette er viktig" - fokus på praktiske implikasjoner, ikke generiske setninger
3. Bruk markdown for struktur (overskrifter, lister, fet tekst for viktige poeng)

VIKTIG FOR TITLER: 
- For representantforslag: Behold "Representantforslag" i tittelen, men fjern representantenes navn. Start med "Representantforslag om..."
- For proposisjon: Bruk den originale tittelen eller en kort versjon.

VIKTIG: I "whyItMatters"-feltet, separer hvert punkt med en ny linje (\\n). Hvert punkt skal være på sin egen linje.

KRITISK VIKTIG - KAPITALISERING:
Du MÅ følge norske kapitaliseringsregler strengt:
- KUN egennavn (Norge, Stortinget, Arbeiderpartiet, Oslo) og første ord i setninger skal ha stor bokstav
- ALDRI bruk stor bokstav på vanlige substantiv, adjektiv eller verb
- FEIL: "Tilrettelegging for Teknologisk Utvikling" → RIKTIG: "tilrettelegging for teknologisk utvikling"
- FEIL: "Styrking av Konkurranse i Markedet" → RIKTIG: "styrking av konkurranse i markedet"
- FEIL: "Politiske Interessekonflikter" → RIKTIG: "politiske interessekonflikter"
- FEIL: "Forbedret Konkurranse" → RIKTIG: "forbedret konkurranse"
- FEIL: "Norsk Politikk" → RIKTIG: "norsk politikk"

I overskrifter og lister:
- Første ord kan ha stor bokstav: "Tilpasning til teknologisk utvikling" (ikke "Tilpasning til Teknologisk Utvikling")
- Eller bruk liten bokstav: "tilpasning til teknologisk utvikling"
- ALDRI stor bokstav på andre ord i overskrifter med mindre det er egennavn

Dette er en kritisk regel - sjekk all tekst for feil kapitalisering før du sender svaret.

Svar i ren JSON med følgende struktur:
{
  "items": [
    {
      "title": "ren tittel uten representantnavn",
      "summary": "2-4 setninger oppsummering som er informativ og relevant",
      "whyItMatters": "Første konkrete punkt om hvorfor dette er viktig\\nAndre konkrete punkt om hvorfor dette er viktig",
      "url": "dokumentets url"
    }
  ]
}

Dokumenter (inkluder all tilgjengelig kontekst):
`;

export async function summarizeDocuments(
  documents: StortingetDocument[]
): Promise<DigestItem[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (documents.length === 0) {
    return [];
  }

  try {
    // Prepare documents for the prompt with full context
    const documentsText = documents
      .map(
        (doc, index) => {
          let docText = `
Dokument ${index + 1}:
Tittel: ${doc.title}
Dokumentgruppe: ${doc.dokumentgruppe || "Ikke spesifisert"}
Tema: ${doc.tema || "Ikke spesifisert"}
URL: ${doc.url}
`;

          // Add grunnlag (basis for case) if available
          if (doc.grunnlag) {
            docText += `\nGrunnlag for saken:\n${doc.grunnlag}\n`;
          }

          // Add referat (meeting minutes) if available
          if (doc.referat) {
            docText += `\nReferat:\n${doc.referat}\n`;
          }

          // Add full text or fallback to basic content
          if (doc.fullText) {
            docText += `\nFullstendig tekst:\n${doc.fullText}\n`;
          } else if (doc.text) {
            docText += `\nInnhold: ${doc.text}\n`;
          } else if (doc.content) {
            docText += `\nInnhold: ${doc.content}\n`;
          }

          // Add komite (committee) if available
          if (doc.komite) {
            docText += `\nKomité: ${doc.komite}\n`;
          }

          // Add departement ("Fra") if available
          if (doc.departement) {
            docText += `\nFra: ${doc.departement}\n`;
          }

          // Add status if available
          if (doc.status) {
            docText += `\nStatus: ${doc.status}\n`;
          }

          // Add saksgang (case progression) if available
          if (doc.saksgang && doc.saksgang.length > 0) {
            docText += `\nSaksgang:\n`;
            doc.saksgang.forEach((sg, i) => {
              docText += `${i + 1}. ${sg.steg}`;
              if (sg.dato) docText += ` (${sg.dato})`;
              if (sg.komite) docText += ` - ${sg.komite}`;
              if (sg.beskrivelse) docText += `: ${sg.beskrivelse}`;
              docText += `\n`;
            });
          }

          // Add source information
          if (doc.forslagstiller_liste && doc.forslagstiller_liste.length > 0) {
            docText += `\nForslagstiller(e): ${doc.forslagstiller_liste.map(r => `${r.fornavn} ${r.etternavn} (${r.parti?.navn || ""})`).join(", ")}\n`;
          }

          return docText;
        }
      )
      .join("\n---\n");

    const fullPrompt = PROMPT_TEMPLATE + documentsText;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du er en assistent som oppsummerer offentlige dokumenter fra Stortinget på norsk. Du MÅ svare med gyldig JSON. Unngå linjeskift i JSON-strenger, bruk \\n for nye linjer.",
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000, // Increased to handle longer responses and prevent truncation
    });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No response from OpenAI");
        }

        // Parse JSON response with error handling
        let parsed;
        try {
          // Try to extract JSON from markdown code blocks if present
          let jsonContent = content.trim();
          const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }
          
          parsed = JSON.parse(jsonContent);
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          console.error("Content preview:", content.substring(0, 500));
          console.error("Content length:", content.length);
          // Try to fix common JSON issues
          try {
            let fixedContent = content.trim();
            
            // Extract JSON object if wrapped in markdown or extra text
            const jsonObjectMatch = fixedContent.match(/\{[\s\S]*\}/);
            if (jsonObjectMatch) {
              fixedContent = jsonObjectMatch[0];
            }
            
            // Fix unescaped newlines in string values
            // Walk through the string and escape newlines that are inside string values
            let inString = false;
            let escapeNext = false;
            let result = '';
            for (let i = 0; i < fixedContent.length; i++) {
              const char = fixedContent[i];
              const nextChar = fixedContent[i + 1];
              
              if (escapeNext) {
                result += char;
                escapeNext = false;
                continue;
              }
              
              if (char === '\\') {
                result += char;
                escapeNext = true;
                continue;
              }
              
              if (char === '"') {
                // Toggle string state (escaped quotes are already handled by escapeNext)
                inString = !inString;
                result += char;
                continue;
              }
              
              if (inString) {
                // Inside a string - escape newlines and carriage returns
                if (char === '\n') {
                  result += '\\n';
                } else if (char === '\r') {
                  result += '\\r';
                  // Skip \n if it follows \r
                  if (nextChar === '\n') {
                    i++;
                  }
                } else if (char === '\t') {
                  result += '\\t';
                } else {
                  result += char;
                }
              } else {
                result += char;
              }
            }
            fixedContent = result;
            
            // Remove trailing commas
            fixedContent = fixedContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            
            parsed = JSON.parse(fixedContent);
          } catch (retryError) {
            console.error("Retry parse also failed:", retryError);
            // Fall back to creating basic summaries from document data
            throw new Error(`Failed to parse OpenAI JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          }
        }

    // Handle both single object and array responses
    let items: DigestItem[];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed.items && Array.isArray(parsed.items)) {
      items = parsed.items;
    } else if (parsed.title) {
      // Single document response
      items = [parsed];
    } else {
      throw new Error("Unexpected response format from OpenAI");
    }

    // Helper function to extract department from proposisjon
    async function getDepartment(doc: StortingetDocument): Promise<string> {
      // First, use the extracted departement field if available
      if (doc.departement) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEBUG] Using extracted departement: "${doc.departement}" for doc ${doc.sakId}`);
        }
        return doc.departement;
      }
      
      // Fallback: Parse from henvisning pattern
      if (doc.henvisning) {
        // Prop. X S = Statsbudsjett/Finansdepartementet
        // Prop. X L = Lov/Justisdepartementet
        // Prop. X M = Miljødepartementet, etc.
        if (doc.henvisning.includes(" S ")) {
          return "Finansdepartementet";
        }
      }
      
      // Default fallback
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] No departement found for doc ${doc.sakId}, using fallback "Regjeringen"`);
      }
      return "Regjeringen";
    }

    // Build source information for all items
    const itemsWithSource = await Promise.all(
      items.map(async (item, index) => {
        const doc = documents[index];
        
        // Build source information
        let source: DigestItem["source"] | undefined;
        if (doc?.dokumentgruppe === "proposisjon") {
          const department = await getDepartment(doc);
          source = {
            type: "regjering",
            department,
          };
        } else if (doc?.dokumentgruppe === "representantforslag" && doc.forslagstiller_liste) {
          // Representantforslag comes from individual representatives
          source = {
            type: "representant",
            representatives: doc.forslagstiller_liste.map((rep) => {
              // Normalize party ID - API sometimes returns "A" for "Ap"
              let partyId = rep.parti?.id || "";
              if (partyId === "A") {
                partyId = "Ap";
              }
              
              return {
                name: `${rep.fornavn} ${rep.etternavn}`,
                party: rep.parti?.navn || "Ukjent parti",
                partyId: partyId,
                url: rep.id ? `https://www.stortinget.no/no/Representanter-og-komiteer/Representantene/Representant/?perid=${rep.id}` : "",
              };
            }),
          };
        }

      // Clean up title for representantforslag - remove representative names but keep "Representantforslag"
      let cleanTitle = item.title || doc?.title || "Ingen tittel";
      if (doc?.dokumentgruppe === "representantforslag") {
        // Remove patterns like "fra stortingsrepresentantene X, Y, Z" but keep "Representantforslag"
        cleanTitle = cleanTitle
          .replace(/^Representantforslag fra stortingsrepresentantene[^,]+(?:, [^,]+)* og [^,]+ om /i, "Representantforslag om ")
          .replace(/^Representantforslag fra [^,]+(?:, [^,]+)* og [^,]+ om /i, "Representantforslag om ")
          .replace(/^Representantforslag fra [^,]+ om /i, "Representantforslag om ");
        // Ensure it starts with "Representantforslag" if it doesn't already
        if (!cleanTitle.startsWith("Representantforslag")) {
          cleanTitle = "Representantforslag om " + cleanTitle;
        }
      }

      return {
        title: cleanTitle,
        summary: item.summary || "Ingen oppsummering tilgjengelig",
        whyItMatters: item.whyItMatters || "Ingen informasjon",
        url: item.url || doc?.url || "",
        tema: doc?.tema,
        date: doc?.date,
        source,
      };
      })
    );

    return itemsWithSource;
  } catch (error) {
    console.error("Error summarizing documents:", error);
    // Fallback: return basic summaries
    return documents.map((doc) => ({
      title: doc.title,
      summary: doc.text || doc.content || "Ingen oppsummering tilgjengelig",
      whyItMatters: "Viktig for folkevalgte og politikere",
      url: doc.url,
    }));
  }
}

