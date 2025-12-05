import { StortingetDocument } from "@/types";
import { XMLParser } from "fast-xml-parser";
import { storage } from "./storage";

const STORTINGET_API_BASE =
  process.env.STORTINGET_API_BASE || "https://data.stortinget.no/eksport";

export async function fetchRecentDocuments(): Promise<StortingetDocument[]> {
  try {
    // Fetch recent cases/documents from Stortinget API (returns XML)
    // Use AbortController for timeout (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${STORTINGET_API_BASE}/saker`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

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

    console.log(`Filtering documents from ${weekAgo.toISOString()} to ${now.toISOString()}`);

    // Get stored documents to check what needs updating
    const storedDocs = await storage.getDocumentsByDateRange(weekAgo, now);
    const storedDocsMap = new Map(storedDocs.map(doc => [doc.sakId, doc]));

    const filteredSaker = saker
      .filter((sak: any) => {
        // Use sist_oppdatert_dato (last updated date) for filtering
        const dateStr = sak.sist_oppdatert_dato || sak.respons_dato_tid;
        if (!dateStr) return false;
        const docDate = new Date(dateStr);
        return !isNaN(docDate.getTime()) && docDate >= weekAgo;
      })
      .sort((a: any, b: any) => {
        // Sort by date descending (most recent first)
        const dateA = new Date(a.sist_oppdatert_dato || a.respons_dato_tid || 0);
        const dateB = new Date(b.sist_oppdatert_dato || b.respons_dato_tid || 0);
        return dateB.getTime() - dateA.getTime();
      });
    // No limit - show ALL documents from the past 7 days
    
    // Identify which documents need to be fetched/updated
    const sakerToFetch = filteredSaker.filter((sak: any) => {
      const stored = storedDocsMap.get(sak.id);
      if (!stored) {
        console.log(`New document: ${sak.id}`);
        return true; // New document, need to fetch
      }
      // Check if document was updated
      const storedLastUpdated = stored.lastUpdated || stored.date;
      const apiLastUpdated = sak.sist_oppdatert_dato || sak.respons_dato_tid;
      if (storedLastUpdated !== apiLastUpdated) {
        console.log(`Updated document: ${sak.id} (${storedLastUpdated} -> ${apiLastUpdated})`);
        return true; // Document updated, need to refetch
      }
      return false; // Already have latest version
    });
    
    console.log(`Found ${sakerToFetch.length} new/updated documents out of ${filteredSaker.length} total`);

    // Fetch details for new/updated documents in parallel
    const newDocuments = await Promise.all(
      sakerToFetch.map(async (sak: any) => {
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

        // Try to extract departement from initial sak object
        let departement = "";
        if (sak.departement) {
          departement = typeof sak.departement === 'string' 
            ? sak.departement 
            : (sak.departement.navn || String(sak.departement || ""));
        } else if (sak.fra) {
          departement = typeof sak.fra === 'string' ? sak.fra : String(sak.fra || "");
        } else if (sak.fra_departement) {
          departement = typeof sak.fra_departement === 'string' 
            ? sak.fra_departement 
            : (sak.fra_departement.navn || String(sak.fra_departement || ""));
        }

        // Fetch detailed sak information if sakId is available
        let grunnlag = "";
        let referat = "";
        let fullText = "";
        let komite = "";
        let status = "";
        let innstillingstekst = "";
        let saksgang: Array<{ steg: string; dato?: string; komite?: string; beskrivelse?: string }> = [];
        let publikasjonReferanser: Array<{ eksport_id?: string; lenke_tekst: string; lenke_url: string; type: string; undertype?: string }> = [];

        if (sakId) {
          try {
            // Use AbortController for timeout (30 seconds)
            const detailController = new AbortController();
            const detailTimeoutId = setTimeout(() => detailController.abort(), 30000);
            
            // Correct format: /sak?sakid=ID (query parameter, not path!)
            const sakDetailResponse = await fetch(`${STORTINGET_API_BASE}/sak?sakid=${sakId}`, {
              signal: detailController.signal,
              next: { revalidate: 300 }, // Cache for 5 minutes
            });
            
            clearTimeout(detailTimeoutId);
            
            if (sakDetailResponse.ok) {
              const sakDetailXml = await sakDetailResponse.text();
              const sakDetailParsed = parser.parse(sakDetailXml);
              // The root element is "detaljert_sak" according to the API docs
              const sakDetail = sakDetailParsed?.detaljert_sak || sakDetailParsed?.sak;
              
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

                // Extract komite (committee) - can be direct object or in liste
                if (sakDetail.komite) {
                  komite = typeof sakDetail.komite === 'string' 
                    ? sakDetail.komite 
                    : (sakDetail.komite.navn || String(sakDetail.komite || ""));
                } else if (sakDetail.komite_liste && sakDetail.komite_liste.komite) {
                  const komiteListe = Array.isArray(sakDetail.komite_liste.komite)
                    ? sakDetail.komite_liste.komite
                    : [sakDetail.komite_liste.komite];
                  komite = komiteListe.map((k: any) => k.navn || "").filter((n: string) => n).join(", ");
                }

                // Extract status - try multiple possible fields
                if (sakDetail.status) {
                  status = typeof sakDetail.status === 'string' ? sakDetail.status : String(sakDetail.status);
                } else if (sakDetail.status_beskrivelse) {
                  status = typeof sakDetail.status_beskrivelse === 'string' ? sakDetail.status_beskrivelse : String(sakDetail.status_beskrivelse);
                }

                // Extract departement ("Fra") - the department that submitted the case
                // Only override if we don't already have it from the initial sak object
                if (!departement) {
                  // Check in various possible locations in the XML
                  if (sakDetail.departement) {
                    departement = typeof sakDetail.departement === 'string' 
                      ? sakDetail.departement 
                      : (sakDetail.departement.navn || String(sakDetail.departement || ""));
                  } else if (sakDetail.fra) {
                    departement = typeof sakDetail.fra === 'string' ? sakDetail.fra : String(sakDetail.fra || "");
                  } else if (sakDetail.fra_departement) {
                    departement = typeof sakDetail.fra_departement === 'string' 
                      ? sakDetail.fra_departement 
                      : (sakDetail.fra_departement.navn || String(sakDetail.fra_departement || ""));
                  }
                  
                  // Also check in saksgang for "Fra" information (first step often has the department)
                  if (!departement && sakDetail.saksgang_liste) {
                    const saksgangListe = Array.isArray(sakDetail.saksgang_liste.saksgang)
                      ? sakDetail.saksgang_liste.saksgang
                      : sakDetail.saksgang_liste.saksgang ? [sakDetail.saksgang_liste.saksgang] : [];
                    if (saksgangListe.length > 0) {
                      const firstStep = saksgangListe[0];
                      if (firstStep.fra) {
                        departement = typeof firstStep.fra === 'string' ? firstStep.fra : String(firstStep.fra || "");
                      } else if (firstStep.departement) {
                        departement = typeof firstStep.departement === 'string' 
                          ? firstStep.departement 
                          : (firstStep.departement.navn || String(firstStep.departement || ""));
                      }
                    }
                  }
                  
                  // Debug: log available fields if departement still not found
                  if (!departement && process.env.NODE_ENV === 'development') {
                    console.log(`[DEBUG] No departement found for sak ${sakId}. Available fields:`, Object.keys(sakDetail).slice(0, 20));
                  }
                }
                
                // Debug log extracted values
                if (process.env.NODE_ENV === 'development' && (departement || status)) {
                  console.log(`[DEBUG] Sak ${sakId}: departement="${departement}", status="${status}"`);
                }

                // Extract saksgang (case progression) - can be direct object or in liste
                if (sakDetail.saksgang) {
                  // saksgang can be a single object with saksgang_steg_liste
                  if (sakDetail.saksgang.saksgang_steg_liste) {
                    const stegListe = Array.isArray(sakDetail.saksgang.saksgang_steg_liste.saksgang_steg)
                      ? sakDetail.saksgang.saksgang_steg_liste.saksgang_steg
                      : sakDetail.saksgang.saksgang_steg_liste.saksgang_steg ? [sakDetail.saksgang.saksgang_steg_liste.saksgang_steg] : [];
                    saksgang = stegListe.map((sg: any) => ({
                      steg: sg.navn || sg.id || "",
                      dato: sg.dato || "",
                      komite: sg.komite?.navn || komite || "",
                      beskrivelse: sg.beskrivelse || sg.tekst || "",
                    }));
                  }
                } else if (sakDetail.saksgang_liste) {
                  const saksgangListe = Array.isArray(sakDetail.saksgang_liste.saksgang)
                    ? sakDetail.saksgang_liste.saksgang
                    : sakDetail.saksgang_liste.saksgang ? [sakDetail.saksgang_liste.saksgang] : [];
                  saksgang = saksgangListe.map((sg: any) => ({
                    steg: sg.steg || sg.type || sg.navn || "",
                    dato: sg.dato || "",
                    komite: sg.komite?.navn || "",
                    beskrivelse: sg.beskrivelse || sg.tekst || "",
                  }));
                }
                
                // Extract innstillingstekst (committee recommendation text) - very valuable!
                if (sakDetail.innstillingstekst && !sakDetail.innstillingstekst['@_i:nil']) {
                  innstillingstekst = typeof sakDetail.innstillingstekst === 'string' 
                    ? sakDetail.innstillingstekst 
                    : String(sakDetail.innstillingstekst || "");
                  if (innstillingstekst && !fullText.includes(innstillingstekst)) {
                    if (fullText) fullText += "\n\n";
                    fullText += `Innstilling: ${innstillingstekst}`;
                  }
                }
                
                // Extract publikasjon_referanse_liste (publication references with PDF links!)
                if (sakDetail.publikasjon_referanse_liste && sakDetail.publikasjon_referanse_liste.publikasjon_referanse) {
                  const pubRefs = Array.isArray(sakDetail.publikasjon_referanse_liste.publikasjon_referanse)
                    ? sakDetail.publikasjon_referanse_liste.publikasjon_referanse
                    : [sakDetail.publikasjon_referanse_liste.publikasjon_referanse];
                  
                  publikasjonReferanser = pubRefs
                    .filter((p: any) => p && !p['@_i:nil'])
                    .map((p: any) => {
                      const eksportId = p.eksport_id && !p.eksport_id['@_i:nil'] 
                        ? (typeof p.eksport_id === 'string' ? p.eksport_id : String(p.eksport_id || ""))
                        : undefined;
                      
                      return {
                        eksport_id: eksportId,
                        lenke_tekst: typeof p.lenke_tekst === 'string' ? p.lenke_tekst : String(p.lenke_tekst || ""),
                        lenke_url: typeof p.lenke_url === 'string' ? p.lenke_url : String(p.lenke_url || ""),
                        type: typeof p.type === 'string' ? p.type : String(p.type || ""),
                        undertype: p.undertype && !p.undertype['@_i:nil'] 
                          ? (typeof p.undertype === 'string' ? p.undertype : String(p.undertype || ""))
                          : undefined,
                      };
                    });
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
          departement: departement || undefined,
          saksgang: saksgang.length > 0 ? saksgang : undefined,
          publikasjon_referanser: publikasjonReferanser.length > 0 ? publikasjonReferanser : undefined,
          innstillingstekst: innstillingstekst || undefined,
        } as StortingetDocument;
      })
    );
    
    // Save new/updated documents to storage
    await Promise.all(newDocuments.map(doc => {
      if (doc.sakId) {
        return storage.saveDocument(doc);
      }
    }));
    
    // Combine stored and new documents
    const allDocuments: StortingetDocument[] = [];
    
    // Add stored documents that weren't updated
    for (const sak of filteredSaker) {
      const stored = storedDocsMap.get(sak.id);
      if (stored && !sakerToFetch.find((s: any) => s.id === sak.id)) {
        allDocuments.push(stored);
      }
    }
    
    // Add newly fetched documents
    allDocuments.push(...newDocuments);
    
    // Sort by date descending
    allDocuments.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    return allDocuments;
  } catch (error: any) {
    if (error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.error("Timeout connecting to Stortinget API. The API may be slow or unavailable.");
    } else {
      console.error("Error fetching Stortinget documents:", error);
    }
    // Return empty array on error to allow graceful degradation
    return [];
  }
}

