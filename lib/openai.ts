import OpenAI from "openai";
import { StortingetDocument, DigestItem } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPT_TEMPLATE = `Oppgave: Du får noen offentlige dokumenter fra Stortinget.
Lag en kort norsk oppsummering for hvert dokument (2–4 setninger), og legg til 1–2 punkter om "Hvorfor dette er viktig".
VIKTIG: I "whyItMatters"-feltet, separer hvert punkt med en ny linje (\\n). Hvert punkt skal være på sin egen linje.

VIKTIG FOR TITLER: 
- For representantforslag: Behold "Representantforslag" i tittelen, men fjern representantenes navn. Start med "Representantforslag om..."
- For proposisjon: Bruk den originale tittelen eller en kort versjon.

Svar i ren JSON med følgende struktur:
{
  "items": [
    {
      "title": "ren tittel uten representantnavn",
      "summary": "2-4 setninger oppsummering",
      "whyItMatters": "Første punkt om hvorfor dette er viktig\\nAndre punkt om hvorfor dette er viktig",
      "url": "dokumentets url"
    }
  ]
}

Dokumenter:
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
    // Prepare documents for the prompt
    const documentsText = documents
      .map(
        (doc, index) => `
Dokument ${index + 1}:
Tittel: ${doc.title}
URL: ${doc.url}
Innhold: ${doc.text || doc.content || "Ingen innhold tilgjengelig"}
`
      )
      .join("\n---\n");

    const fullPrompt = PROMPT_TEMPLATE + documentsText;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du er en assistent som oppsummerer offentlige dokumenter fra Stortinget på norsk.",
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse JSON response
    const parsed = JSON.parse(content);

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

