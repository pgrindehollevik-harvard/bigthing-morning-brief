import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

const STORTINGET_API_BASE = "https://data.stortinget.no/eksport";

// Helper to extract document references from henvisning
function extractDocumentReferences(henvisning: string): string[] {
  // Pattern: "Dokument 8:1 S (2025-2026), Innst. 34 S (2025-2026)"
  const matches = henvisning.match(/(?:Dokument|Innst\.)\s+[\d:]+/g);
  return matches || [];
}

/**
 * Debug endpoint to explore what data is available from Stortinget API
 * 
 * This helps us understand:
 * 1. What fields are in the /saker endpoint
 * 2. What fields are in the /sak/{id} endpoint
 * 3. What PDF/document URLs are available
 * 4. The structure of the XML response
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sakId = searchParams.get("sakId");
    const publikasjonId = searchParams.get("publikasjonId");
    const explorePublikasjoner = searchParams.get("explore") === "publikasjoner";
    
    if (sakId) {
      // Try different ID formats - the API might need session prefix
      const triedFormats: Array<{ format: string; status: number; ok: boolean }> = [];
      
      // Get session from query or use current
      const session = searchParams.get("session") || "2025-2026";
      
      // Correct format: /sak?sakid=ID (query parameter, not path!)
      const response = await fetch(`${STORTINGET_API_BASE}/sak?sakid=${sakId}`, {
        next: { revalidate: 3600 },
      });
      
      triedFormats.push({ format: `?sakid=${sakId}`, status: response.status, ok: response.ok });
      
      if (!response || !response.ok) {
        return NextResponse.json({ 
          error: `Failed to fetch sak ${sakId}`,
          triedFormats,
          hint: "The sak detail endpoint might not exist, or the format is different. The /saker endpoint only provides metadata - detailed content might be in separate document endpoints.",
          note: "Check if there's a /dokumenter endpoint or if content is only available via the web interface URLs"
        }, { status: 500 });
      }
      
      const xmlText = await response.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
      });
      
      const parsed = parser.parse(xmlText);
      // The root element is "detaljert_sak" according to the API docs
      const sakDetail = parsed?.detaljert_sak || parsed?.sak;
      
      if (!sakDetail) {
        return NextResponse.json({ error: "No sak found" }, { status: 404 });
      }
      
      // Extract all available fields and structure
      const availableData = {
        sakId: sakId,
        allFields: Object.keys(sakDetail),
        structure: {
          // Basic info
          id: sakDetail.id,
          tittel: sakDetail.tittel,
          korttittel: sakDetail.korttittel,
          dokumentgruppe: sakDetail.dokumentgruppe,
          status: sakDetail.status,
          status_beskrivelse: sakDetail.status_beskrivelse,
          
          // Department/Source
          departement: sakDetail.departement,
          fra: sakDetail.fra,
          fra_departement: sakDetail.fra_departement,
          
          // Dates
          sist_oppdatert_dato: sakDetail.sist_oppdatert_dato,
          respons_dato_tid: sakDetail.respons_dato_tid,
          
          // Content
          innhold: sakDetail.innhold ? (typeof sakDetail.innhold === 'string' ? sakDetail.innhold.substring(0, 200) : 'object') : null,
          beskrivelse: sakDetail.beskrivelse ? (typeof sakDetail.beskrivelse === 'string' ? sakDetail.beskrivelse.substring(0, 200) : 'object') : null,
          henvisning: sakDetail.henvisning,
          
          // Lists
          grunnlag_liste: sakDetail.grunnlag_liste ? {
            hasData: true,
            isArray: Array.isArray(sakDetail.grunnlag_liste.grunnlag),
            count: Array.isArray(sakDetail.grunnlag_liste.grunnlag) 
              ? sakDetail.grunnlag_liste.grunnlag.length 
              : (sakDetail.grunnlag_liste.grunnlag ? 1 : 0),
            sample: Array.isArray(sakDetail.grunnlag_liste.grunnlag)
              ? sakDetail.grunnlag_liste.grunnlag[0]
              : sakDetail.grunnlag_liste.grunnlag,
          } : null,
          
          referat_liste: sakDetail.referat_liste ? {
            hasData: true,
            isArray: Array.isArray(sakDetail.referat_liste.referat),
            count: Array.isArray(sakDetail.referat_liste.referat)
              ? sakDetail.referat_liste.referat.length
              : (sakDetail.referat_liste.referat ? 1 : 0),
            sample: Array.isArray(sakDetail.referat_liste.referat)
              ? sakDetail.referat_liste.referat[0]
              : sakDetail.referat_liste.referat,
          } : null,
          
          komite_liste: sakDetail.komite_liste ? {
            hasData: true,
            komite: sakDetail.komite_liste.komite,
          } : null,
          
          saksgang_liste: sakDetail.saksgang_liste ? {
            hasData: true,
            isArray: Array.isArray(sakDetail.saksgang_liste.saksgang),
            count: Array.isArray(sakDetail.saksgang_liste.saksgang)
              ? sakDetail.saksgang_liste.saksgang.length
              : (sakDetail.saksgang_liste.saksgang ? 1 : 0),
            sample: Array.isArray(sakDetail.saksgang_liste.saksgang)
              ? sakDetail.saksgang_liste.saksgang[0]
              : sakDetail.saksgang_liste.saksgang,
          } : null,
          
          emne_liste: sakDetail.emne_liste ? {
            hasData: true,
            emne: sakDetail.emne_liste.emne,
          } : null,
          
          forslagstiller_liste: sakDetail.forslagstiller_liste ? {
            hasData: true,
            representant: sakDetail.forslagstiller_liste.representant,
          } : null,
          
          // publikasjon_referanse_liste - publication references with PDF links!
          publikasjon_referanse_liste: sakDetail.publikasjon_referanse_liste ? {
            hasData: true,
            isArray: Array.isArray(sakDetail.publikasjon_referanse_liste.publikasjon_referanse),
            count: Array.isArray(sakDetail.publikasjon_referanse_liste.publikasjon_referanse)
              ? sakDetail.publikasjon_referanse_liste.publikasjon_referanse.length
              : (sakDetail.publikasjon_referanse_liste.publikasjon_referanse ? 1 : 0),
            sample: Array.isArray(sakDetail.publikasjon_referanse_liste.publikasjon_referanse)
              ? sakDetail.publikasjon_referanse_liste.publikasjon_referanse[0]
              : sakDetail.publikasjon_referanse_liste.publikasjon_referanse,
            // Check which ones have eksport_id (available for export/PDF)
            withEksportId: Array.isArray(sakDetail.publikasjon_referanse_liste.publikasjon_referanse)
              ? sakDetail.publikasjon_referanse_liste.publikasjon_referanse.filter((p: any) => p.eksport_id && !p.eksport_id['@_i:nil'])
              : (sakDetail.publikasjon_referanse_liste.publikasjon_referanse?.eksport_id && !sakDetail.publikasjon_referanse_liste.publikasjon_referanse.eksport_id['@_i:nil'] ? [sakDetail.publikasjon_referanse_liste.publikasjon_referanse] : []),
          } : null,
          
          // Other important fields from API docs
          innstillingstekst: sakDetail.innstillingstekst ? (typeof sakDetail.innstillingstekst === 'string' ? sakDetail.innstillingstekst.substring(0, 200) : 'object') : null,
          vedtakstekst: sakDetail.vedtakstekst,
          kortvedtak: sakDetail.kortvedtak,
          sakgang: sakDetail.sakgang,
          sak_opphav: sakDetail.sak_opphav,
        },
        // Full raw structure (limited to avoid huge responses)
        rawSample: {
          ...Object.fromEntries(
            Object.entries(sakDetail).slice(0, 10).map(([key, value]) => [
              key,
              typeof value === 'string' && value.length > 500 
                ? value.substring(0, 500) + '...' 
                : value
            ])
          )
        }
      };
      
      return NextResponse.json(availableData, { status: 200 });
    } else if (publikasjonId) {
      // Fetch specific publikasjon (this is where PDFs likely are!)
      const response = await fetch(`${STORTINGET_API_BASE}/publikasjon/${publikasjonId}`, {
        next: { revalidate: 3600 },
      });
      
      if (!response.ok) {
        return NextResponse.json({ 
          error: `Failed to fetch publikasjon ${publikasjonId}: ${response.status}`,
          hint: "Try exploring /publikasjoner endpoint first to find available publikasjon IDs"
        }, { status: 500 });
      }
      
      const xmlText = await response.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
      });
      
      const parsed = parser.parse(xmlText);
      const publikasjon = parsed?.publikasjon;
      
      if (!publikasjon) {
        return NextResponse.json({ error: "No publikasjon found" }, { status: 404 });
      }
      
      return NextResponse.json({
        publikasjonId,
        allFields: Object.keys(publikasjon),
        structure: {
          id: publikasjon.id,
          tittel: publikasjon.tittel,
          type: publikasjon.type,
          sesjon_id: publikasjon.sesjon_id,
          // Check for PDF/file links
          fil_liste: publikasjon.fil_liste,
          vedlegg_liste: publikasjon.vedlegg_liste,
          pdf_url: publikasjon.pdf_url,
          dokument_url: publikasjon.dokument_url,
          // Content
          innhold: publikasjon.innhold ? (typeof publikasjon.innhold === 'string' ? publikasjon.innhold.substring(0, 500) : 'object') : null,
          tekst: publikasjon.tekst ? (typeof publikasjon.tekst === 'string' ? publikasjon.tekst.substring(0, 500) : 'object') : null,
        },
        rawSample: {
          ...Object.fromEntries(
            Object.entries(publikasjon).slice(0, 15).map(([key, value]) => [
              key,
              typeof value === 'string' && value.length > 500 
                ? value.substring(0, 500) + '...' 
                : value
            ])
          )
        }
      }, { status: 200 });
    } else if (explorePublikasjoner) {
      // Explore publikasjoner endpoint - see what types are available
      const session = searchParams.get("session") || "2025-2026";
      const type = searchParams.get("type") || "dokument"; // dokument, innstilling, etc.
      
      const response = await fetch(`${STORTINGET_API_BASE}/publikasjoner?sesjonid=${session}&type=${type}`, {
        next: { revalidate: 3600 },
      });
      
      if (!response.ok) {
        return NextResponse.json({ 
          error: `Failed to fetch publikasjoner: ${response.status}`,
          triedUrl: `${STORTINGET_API_BASE}/publikasjoner?sesjonid=${session}&type=${type}`
        }, { status: 500 });
      }
      
      const xmlText = await response.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
      });
      
      const parsed = parser.parse(xmlText);
      const publikasjoner = parsed?.publikasjoner_oversikt?.publikasjoner_liste;
      
      if (!publikasjoner || !publikasjoner.publikasjon) {
        return NextResponse.json({ 
          error: "No publikasjoner found",
          note: "Try different type parameter: dokument, innstilling, proposisjon, etc."
        }, { status: 404 });
      }
      
      const pubList = Array.isArray(publikasjoner.publikasjon) 
        ? publikasjoner.publikasjon 
        : [publikasjoner.publikasjon];
      
      return NextResponse.json({
        endpoint: "/publikasjoner",
        session,
        type,
        total: pubList.length,
        samplePublikasjon: {
          id: pubList[0]?.id,
          tittel: pubList[0]?.tittel,
          type: pubList[0]?.type,
          allFields: Object.keys(pubList[0] || {}),
          // Check for file/PDF references
          fil_liste: pubList[0]?.fil_liste,
          vedlegg_liste: pubList[0]?.vedlegg_liste,
        },
        recentPublikasjonIds: pubList.slice(0, 10).map((p: any) => ({
          id: p.id,
          tittel: p.tittel,
          type: p.type,
          sesjon_id: p.sesjon_id,
        }))
      }, { status: 200 });
    } else {
      // Fetch list of recent saker
      const response = await fetch(`${STORTINGET_API_BASE}/saker`, {
        next: { revalidate: 300 },
      });
      
      if (!response.ok) {
        return NextResponse.json({ error: `Failed to fetch saker: ${response.status}` }, { status: 500 });
      }
      
      const xmlText = await response.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
      });
      
      const parsed = parser.parse(xmlText);
      const sakerListe = parsed?.saker_oversikt?.saker_liste;
      
      if (!sakerListe || !sakerListe.sak) {
        return NextResponse.json({ error: "No saker found" }, { status: 404 });
      }
      
      const saker = Array.isArray(sakerListe.sak) ? sakerListe.sak : [sakerListe.sak];
      
      // Get first sak as sample
      const firstSak = saker[0];
      
      const availableData = {
        endpoint: "/saker",
        totalSaker: saker.length,
        sampleSak: {
          id: firstSak.id,
          idType: typeof firstSak.id,
          // Check if there's a session or other identifier
          behandlet_sesjon_id: firstSak.behandlet_sesjon_id,
          sak_fremmet_id: firstSak.sak_fremmet_id,
          allFields: Object.keys(firstSak),
          structure: {
            id: firstSak.id,
            tittel: firstSak.tittel,
            korttittel: firstSak.korttittel,
            dokumentgruppe: firstSak.dokumentgruppe,
            sist_oppdatert_dato: firstSak.sist_oppdatert_dato,
            respons_dato_tid: firstSak.respons_dato_tid,
            henvisning: firstSak.henvisning,
            emne_liste: firstSak.emne_liste,
            forslagstiller_liste: firstSak.forslagstiller_liste,
            // Check for PDF/document links
            dokument_liste: firstSak.dokument_liste,
            vedlegg_liste: firstSak.vedlegg_liste,
            pdf_liste: firstSak.pdf_liste,
            fil_liste: firstSak.fil_liste,
          },
          // Full raw structure (limited)
          rawSample: {
            ...Object.fromEntries(
              Object.entries(firstSak).slice(0, 15).map(([key, value]) => [
                key,
                typeof value === 'string' && value.length > 200 
                  ? value.substring(0, 200) + '...' 
                  : value
              ])
            )
          }
        },
        recentSakerIds: await Promise.all(saker.slice(0, 5).map(async (s: any) => {
          // Test if detailed endpoint exists (correct format: ?sakid=ID)
          const testResponse = await fetch(`${STORTINGET_API_BASE}/sak?sakid=${s.id}`, {
            next: { revalidate: 300 },
          });
          
          return {
            id: s.id,
            behandlet_sesjon_id: s.behandlet_sesjon_id,
            sak_fremmet_id: s.sak_fremmet_id,
            tittel: s.tittel,
            dokumentgruppe: s.dokumentgruppe,
            detailedEndpointExists: testResponse.ok,
            detailedEndpointStatus: testResponse.status,
            // Correct endpoint format: /sak?sakid=ID (query parameter)
            correctEndpoint: `/sak?sakid=${s.id}`,
            // Check henvisning for document references
            henvisning: s.henvisning,
            // Check if there are document IDs we can extract
            documentReferences: s.henvisning ? extractDocumentReferences(s.henvisning) : null,
          };
        }))
      };
      
      return NextResponse.json(availableData, { status: 200 });
    }
  } catch (error: any) {
    console.error("Error in debug-api:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch API data" },
      { status: 500 }
    );
  }
}

