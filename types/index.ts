export interface Representative {
  id: string;
  fornavn: string;
  etternavn: string;
  parti?: {
    id: string;
    navn: string;
  };
}

export interface StortingetDocument {
  title: string;
  date: string;
  url: string;
  content?: string;
  text?: string;
  dokumentgruppe?: string;
  forslagstiller_liste?: Representative[];
  henvisning?: string;
  sakId?: string;
  tema?: string;
  lastUpdated?: string;
  // Enhanced fields for richer context
  grunnlag?: string; // Basis for the case
  referat?: string; // Meeting minutes/reports
  fullText?: string; // Full document text
  komite?: string; // Committee handling the case
  status?: string; // Current status
  departement?: string; // "Fra" - the department that submitted the case
  saksgang?: Array<{
    steg: string;
    dato?: string;
    komite?: string;
    beskrivelse?: string;
  }>;
  // Publication references (PDFs/documents available for export)
  publikasjon_referanser?: Array<{
    eksport_id?: string; // Use this to fetch PDF via /publikasjon/{eksport_id}
    lenke_tekst: string;
    lenke_url: string;
    type: string; // dok8, innstilling, referat, etc.
    undertype?: string;
  }>;
  innstillingstekst?: string; // Committee recommendation text
}

export interface DigestItem {
  title: string;
  summary: string;
  whyItMatters: string;
  url: string;
  tema?: string;
  date?: string;
  source?: {
    type: "regjering" | "representant";
    department?: string;
    representatives?: Array<{
      name: string;
      party: string;
      partyId: string;
      url: string;
    }>;
  };
}

export interface DigestResponse {
  date: string;
  items: DigestItem[];
}

