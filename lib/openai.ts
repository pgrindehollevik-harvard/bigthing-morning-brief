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
      max_tokens: 3000, // Increased to handle longer responses
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
            // Remove trailing commas
            let fixedContent = content.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            // Try to extract just the JSON object if there's extra text
            const jsonObjectMatch = fixedContent.match(/\{[\s\S]*\}/);
            if (jsonObjectMatch) {
              fixedContent = jsonObjectMatch[0];
            }
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
      if (!doc.henvisning) return "Regjeringen";
      
      // Parse from henvisning pattern
      // Prop. X S = Statsbudsjett/Finansdepartementet
      // Prop. X L = Lov/Justisdepartementet
      // Prop. X M = Miljødepartementet, etc.
      if (doc.henvisning.includes(" S ")) {
        return "Finansdepartementet";
      }
      
      // Try to fetch from individual sak endpoint if available
      if (doc.sakId) {
        try {
          const sakResponse = await fetch(`${process.env.STORTINGET_API_BASE || "https://data.stortinget.no/eksport"}/sak/${doc.sakId}`);
          if (sakResponse.ok) {
            const sakText = await sakResponse.text();
            // Look for department in the HTML/XML
            const deptMatch = sakText.match(/([A-ZÆØÅ][a-zæøå]+departementet)/i);
            if (deptMatch) {
              return deptMatch[1];
            }
          }
        } catch (e) {
          // Fallback handled below
        }
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

