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

    // Filter documents from last 2 weeks (14 days)
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    console.log(`Filtering documents from ${twoWeeksAgo.toISOString()} to ${now.toISOString()}`);

    const filteredSaker = saker
      .filter((sak: any) => {
        // Use sist_oppdatert_dato (last updated date) for filtering
        const dateStr = sak.sist_oppdatert_dato || sak.respons_dato_tid;
        if (!dateStr) return false;
        const docDate = new Date(dateStr);
        const isValid = !isNaN(docDate.getTime()) && docDate >= twoWeeksAgo;
        if (isValid) {
          console.log(`Document ${sak.id}: ${dateStr} (${docDate.toISOString()}) - INCLUDED`);
        }
        return isValid;
      })
      .sort((a: any, b: any) => {
        // Sort by date descending (most recent first)
        const dateA = new Date(a.sist_oppdatert_dato || a.respons_dato_tid || 0);
        const dateB = new Date(b.sist_oppdatert_dato || b.respons_dato_tid || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10); // Increase limit to 10 to get more documents across the 14-day window

    // Map with async to fetch full sak details including grunnlag, referat, etc.
    const recentDocuments = await Promise.all(
      filteredSaker.map(async (sak: any) => {
        const sakId = sak.id;
        // Use official title (tittel), fallback to korttittel if tittel is not available
        const title = sak.tittel || sak.korttittel || "Ingen tittel";
        const date = sak.sist_oppdatert_dato || sak.respons_dato_tid || new Date().toISOString();
        
        // Construct URL to the specific sak on the public Stortinget website
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

        // Extract tema from emne_liste
        let tema: string | undefined;
        if (sak.emne_liste && sak.emne_liste.emne) {
          const emner = Array.isArray(sak.emne_liste.emne) 
            ? sak.emne_liste.emne 
            : [sak.emne_liste.emne];
          if (emner.length > 0 && emner[0].navn) {
            tema = emner[0].navn;
          }
        }

        // If tema not found, try to infer from title/content
        if (!tema) {
          const searchText = `${sak.tittel || ""} ${sak.korttittel || ""}`.toLowerCase();
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

        // Fetch detailed sak information if sakId is available
        let grunnlag = "";
        let referat = "";
        let fullText = "";
        let komite = "";
        let status = "";
        let saksgang: Array<{ steg: string; dato?: string; komite?: string; beskrivelse?: string }> = [];

        if (sakId) {
          try {
            const sakDetailResponse = await fetch(`${STORTINGET_API_BASE}/sak/${sakId}`, {
              next: { revalidate: 300 }, // Cache for 5 minutes
            });
            
            if (sakDetailResponse.ok) {
              const sakDetailXml = await sakDetailResponse.text();
              const sakDetailParsed = parser.parse(sakDetailXml);
              const sakDetail = sakDetailParsed?.sak;
              
              if (sakDetail) {
                // Extract grunnlag (basis for the case)
                if (sakDetail.grunnlag_liste) {
                  const grunnlagListe = Array.isArray(sakDetail.grunnlag_liste.grunnlag)
                    ? sakDetail.grunnlag_liste.grunnlag
                    : sakDetail.grunnlag_liste.grunnlag ? [sakDetail.grunnlag_liste.grunnlag] : [];
                  grunnlag = grunnlagListe
                    .map((g: any) => g.tekst || g.tittel || "")
                    .filter((t: string) => t)
                    .join("\n\n");
                }

                // Extract referat (meeting minutes)
                if (sakDetail.referat_liste) {
                  const referatListe = Array.isArray(sakDetail.referat_liste.referat)
                    ? sakDetail.referat_liste.referat
                    : sakDetail.referat_liste.referat ? [sakDetail.referat_liste.referat] : [];
                  referat = referatListe
                    .map((r: any) => r.tekst || r.innhold || "")
                    .filter((t: string) => t)
                    .join("\n\n");
                }

                // Extract komite (committee)
                if (sakDetail.komite_liste && sakDetail.komite_liste.komite) {
                  const komiteListe = Array.isArray(sakDetail.komite_liste.komite)
                    ? sakDetail.komite_liste.komite
                    : [sakDetail.komite_liste.komite];
                  komite = komiteListe.map((k: any) => k.navn || "").filter((n: string) => n).join(", ");
                }

                // Extract status
                if (sakDetail.status) {
                  status = sakDetail.status;
                }

                // Extract saksgang (case progression)
                if (sakDetail.saksgang_liste) {
                  const saksgangListe = Array.isArray(sakDetail.saksgang_liste.saksgang)
                    ? sakDetail.saksgang_liste.saksgang
                    : sakDetail.saksgang_liste.saksgang ? [sakDetail.saksgang_liste.saksgang] : [];
                  saksgang = saksgangListe.map((sg: any) => ({
                    steg: sg.steg || sg.type || "",
                    dato: sg.dato || "",
                    komite: sg.komite?.navn || "",
                    beskrivelse: sg.beskrivelse || sg.tekst || "",
                  }));
                }

                // Combine all text content
                const textParts: string[] = [];
                if (sakDetail.innhold) textParts.push(sakDetail.innhold);
                if (sakDetail.beskrivelse) textParts.push(sakDetail.beskrivelse);
                if (grunnlag) textParts.push(`Grunnlag: ${grunnlag}`);
                if (referat) textParts.push(`Referat: ${referat}`);
                fullText = textParts.join("\n\n");
              }
            }
          } catch (error) {
            console.error(`Error fetching details for sak ${sakId}:`, error);
            // Continue with basic data if detail fetch fails
          }
        }

        return {
          title,
          date,
          url,
          content: sak.henvisning || "",
          text: fullText || sak.henvisning || sak.korttittel || "",
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
          lastUpdated: sak.sist_oppdatert_dato || sak.respons_dato_tid,
          // Enhanced fields
          grunnlag: grunnlag || undefined,
          referat: referat || undefined,
          fullText: fullText || undefined,
          komite: komite || undefined,
          status: status || undefined,
          saksgang: saksgang.length > 0 ? saksgang : undefined,
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

