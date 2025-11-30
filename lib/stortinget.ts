import { StortingetDocument } from "@/types";
import { XMLParser } from "fast-xml-parser";

const STORTINGET_API_BASE =
  process.env.STORTINGET_API_BASE || "https://data.stortinget.no/eksport";

export async function fetchRecentDocuments(): Promise<StortingetDocument[]> {
  try {
    // Fetch recent cases/documents from Stortinget API (returns XML)
    const response = await fetch(`${STORTINGET_API_BASE}/saker`);

    if (!response.ok) {
      throw new Error(`Stortinget API error: ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
    });
    
    const parsed = parser.parse(xmlText);
    
    // Extract saker from XML structure
    const sakerListe = parsed?.saker_oversikt?.saker_liste;
    if (!sakerListe || !sakerListe.sak) {
      return [];
    }
    
    // Handle both single sak and array of saker
    const saker = Array.isArray(sakerListe.sak) ? sakerListe.sak : [sakerListe.sak];

    // Filter documents from last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const filteredSaker = saker
      .filter((sak: any) => {
        // Use sist_oppdatert_dato (last updated date) for filtering
        const dateStr = sak.sist_oppdatert_dato || sak.respons_dato_tid;
        if (!dateStr) return false;
        const docDate = new Date(dateStr);
        return !isNaN(docDate.getTime()) && docDate >= weekAgo;
      })
      .slice(0, 5); // Limit to 5 documents

    // Map with async to fetch tema from individual sak if needed
    const recentDocuments = await Promise.all(
      filteredSaker.map(async (sak: any) => {
        const sakId = sak.id;
        // Use official title (tittel), fallback to korttittel if tittel is not available
        const title = sak.tittel || sak.korttittel || "Ingen tittel";
        const date = sak.sist_oppdatert_dato || sak.respons_dato_tid || new Date().toISOString();
        
        // Construct URL to the specific sak on the public Stortinget website
        // Format: https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=ID
        const url = sakId 
          ? `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${sakId}`
          : "";

        // Extract forslagstiller_liste (proposers) for representantforslag
        let forslagstiller_liste: any[] = [];
        if (sak.forslagstiller_liste && sak.forslagstiller_liste.representant) {
          forslagstiller_liste = Array.isArray(sak.forslagstiller_liste.representant)
            ? sak.forslagstiller_liste.representant
            : [sak.forslagstiller_liste.representant];
        }

        // Extract tema from emne_liste (try from list first)
        let tema: string | undefined;
        if (sak.emne_liste && sak.emne_liste.emne) {
          const emner = Array.isArray(sak.emne_liste.emne) 
            ? sak.emne_liste.emne 
            : [sak.emne_liste.emne];
          // Get the first emne's navn (name)
          if (emner.length > 0 && emner[0].navn) {
            tema = emner[0].navn;
          }
        }

        // If tema not found, try to infer from title/content using keyword matching
        if (!tema) {
          const searchText = `${sak.tittel || ""} ${sak.korttittel || ""}`.toLowerCase();
          
          // List of tema keywords (from user's list) - check in order of specificity
          const temaKeywords: Record<string, string> = {
            'statsbudsjett': 'Statsbudsjettet',
            'budsjett': 'Statsbudsjettet',
            'finans': 'Finanser',
            'skatt': 'Skatter',
            'skatter': 'Skatter',
            'drosje': 'Samferdsel',
            'taxi': 'Samferdsel',
            'transport': 'Samferdsel',
            'rullestol': 'Funksjonshemmede',
            'innvandr': 'Innvandrere',
            'flyktning': 'Innvandrere',
            'ukraina': 'Utenrikssaker',
            'ekomlov': 'Kommunikasjonsteknologi',
            'telekom': 'Kommunikasjonsteknologi',
            'kommunikasjon': 'Kommunikasjonsteknologi',
            'sekundærbosett': 'Innvandrere',
            'bosett': 'Innvandrere',
          };

          for (const [keyword, temaName] of Object.entries(temaKeywords)) {
            if (searchText.includes(keyword)) {
              tema = temaName;
              break;
            }
          }
        }

        return {
          title,
          date,
          url,
          content: sak.henvisning || "",
          text: sak.henvisning || sak.korttittel || "",
          dokumentgruppe: sak.dokumentgruppe || "",
          forslagstiller_liste: forslagstiller_liste.map((rep: any) => ({
            id: rep.id || "",
            fornavn: rep.fornavn || "",
            etternavn: rep.etternavn || "",
            parti: rep.parti ? {
              id: rep.parti.id || "",
              navn: rep.parti.navn || "",
            } : undefined,
          })),
          henvisning: sak.henvisning || "",
          sakId: sakId,
          tema,
        } as StortingetDocument;
      })
    );

    return recentDocuments;
  } catch (error) {
    console.error("Error fetching Stortinget documents:", error);
    // Return empty array on error to allow graceful degradation
    return [];
  }
}

