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
}

export interface DigestItem {
  title: string;
  summary: string;
  whyItMatters: string;
  url: string;
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

