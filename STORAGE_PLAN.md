# Data Storage & Optimization Plan

## Current Issues

1. **Slow Loading**: Every request fetches ALL documents from Stortinget API
   - Sequential API calls to `/sak/{id}` for each document (very slow)
   - No persistent storage - data lost on server restart
   - In-memory cache only lasts 5 minutes

2. **Limited Chat Context**: Chat only receives `DigestItem` (summary)
   - Missing: `grunnlag`, `referat`, `saksgang`, `fullText`, `departement`, `status`
   - Chat can't access full document details for better analysis

## Proposed Solution

### Phase 1: Persistent Storage (SQLite)

**Why SQLite?**
- Simple, file-based database (no server needed)
- Works on Vercel with serverless functions
- Fast reads, good for this use case
- Can migrate to PostgreSQL later if needed

**Schema:**
```sql
-- Full document storage
CREATE TABLE documents (
  sak_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  url TEXT NOT NULL,
  dokumentgruppe TEXT,
  tema TEXT,
  last_updated TEXT,
  departement TEXT,
  status TEXT,
  komite TEXT,
  grunnlag TEXT,
  referat TEXT,
  full_text TEXT,
  saksgang JSON,  -- Store as JSON
  forslagstiller_liste JSON,
  henvisning TEXT,
  content TEXT,
  text TEXT,
  -- Metadata
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Summaries (DigestItem)
CREATE TABLE summaries (
  sak_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  url TEXT NOT NULL,
  tema TEXT,
  date TEXT,
  source_type TEXT,  -- 'regjering' or 'representant'
  source_department TEXT,
  source_representatives JSON,
  -- Metadata
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sak_id) REFERENCES documents(sak_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_documents_date ON documents(date);
CREATE INDEX idx_documents_last_updated ON documents(last_updated);
CREATE INDEX idx_summaries_date ON summaries(date);
```

### Phase 2: Incremental Updates

**Strategy:**
1. Check `last_updated` from Stortinget API
2. Only fetch documents that are:
   - New (not in database)
   - Updated (different `last_updated` than stored)
3. Batch fetch details (parallel requests instead of sequential)

**Implementation:**
```typescript
// lib/database.ts
export async function getStoredDocuments(): Promise<Map<string, StortingetDocument>>
export async function saveDocument(doc: StortingetDocument): Promise<void>
export async function getDocumentBySakId(sakId: string): Promise<StortingetDocument | null>
export async function getStoredSummaries(): Promise<Map<string, DigestItem>>

// lib/stortinget.ts - Modified
export async function fetchRecentDocuments(): Promise<StortingetDocument[]> {
  // 1. Get stored documents from DB
  const stored = await getStoredDocuments();
  
  // 2. Fetch list of recent saker from API
  const recentSaker = await fetchSakerList();
  
  // 3. Identify new/updated documents
  const toFetch = recentSaker.filter(sak => {
    const stored = stored.get(sak.id);
    return !stored || stored.lastUpdated !== sak.sist_oppdatert_dato;
  });
  
  // 4. Fetch details in parallel (Promise.all)
  const newDocs = await Promise.all(
    toFetch.map(sak => fetchSakDetails(sak.id))
  );
  
  // 5. Save to database
  await Promise.all(newDocs.map(doc => saveDocument(doc)));
  
  // 6. Return all recent documents (from DB)
  return Array.from(stored.values())
    .filter(doc => isRecent(doc.date));
}
```

### Phase 3: Enhanced Chat Context

**Current Problem:**
- Chat receives only `DigestItem` (limited context)
- Comment in code: `// (This would come from the full StortingetDocument if we pass it through)`

**Solution:**
```typescript
// app/api/chat/route.ts - Modified
export async function POST(request: Request) {
  const { message, cases = [], conversationHistory = [] } = await request.json();
  
  // Fetch full documents from database for chat context
  const fullDocuments = await Promise.all(
    cases.map(async (caseItem: DigestItem) => {
      // Extract sakId from URL or store it in DigestItem
      const sakId = extractSakIdFromUrl(caseItem.url);
      const fullDoc = await getDocumentBySakId(sakId);
      return fullDoc || null;
    })
  );
  
  // Build rich context with FULL document data
  const casesContext = fullDocuments
    .filter(doc => doc !== null)
    .map((doc, index) => {
      return `
Sak ${index + 1}:
Tittel: ${doc.title}
Oppsummering: ${cases[index].summary}
Hvorfor viktig: ${cases[index].whyItMatters}
Tema: ${doc.tema || "Ikke spesifisert"}
Fra: ${doc.departement || "Ukjent"}
Status: ${doc.status || "Ikke spesifisert"}
Komité: ${doc.komite || "Ikke spesifisert"}

Grunnlag for saken:
${doc.grunnlag || "Ikke tilgjengelig"}

Referat:
${doc.referat || "Ikke tilgjengelig"}

Saksgang:
${doc.saksgang?.map(sg => `- ${sg.steg} (${sg.dato})`).join('\n') || "Ikke tilgjengelig"}

Full tekst:
${doc.fullText || doc.text || "Ikke tilgjengelig"}

URL: ${doc.url}
`;
    })
    .join("\n---\n");
}
```

### Phase 4: Background Updates (Optional)

**Vercel Cron Jobs** or **API Route with scheduled calls:**
```typescript
// app/api/cron/update-documents/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Fetch and update documents
  await fetchRecentDocuments();
  
  // Regenerate summaries if needed
  await regenerateSummaries();
  
  return Response.json({ success: true });
}
```

## Implementation Order

1. **Step 1**: Add SQLite database with schema
2. **Step 2**: Modify `fetchRecentDocuments` to use database (incremental updates)
3. **Step 3**: Update chat API to fetch full documents from database
4. **Step 4**: Add background job (optional, for pre-fetching)

## Benefits

- **Faster Loading**: Database reads are much faster than API calls
- **Better Chat Context**: Full document data available for analysis
- **Reduced API Load**: Only fetch new/updated documents
- **Persistent**: Data survives server restarts
- **Scalable**: Can migrate to PostgreSQL if needed

## Trade-offs

- **Storage**: SQLite file size (manageable for this use case)
- **Complexity**: Adds database layer (but SQLite is simple)
- **Sync**: Need to handle cases where API data changes

