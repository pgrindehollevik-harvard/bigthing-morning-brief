# Database Strategy: KV vs Relational DB

## Current Usage Patterns

Looking at our code, we're doing:

1. **Simple lookups by sakId** (key-value is perfect)
   - `getDocument(sakId)` 
   - `getSummary(sakId)`
   - `getPdfChunks(eksportId)`

2. **Date range queries** (works but not ideal in KV)
   - `getDocumentsByDateRange(startDate, endDate)`
   - Currently: Scan all documents (OK for small datasets)

3. **No complex queries**
   - No joins
   - No aggregations
   - No full-text search across multiple fields
   - No relationships between entities

## When Vercel KV (Redis) is Sufficient ✅

**Stick with KV if:**
- ✅ Simple key-value lookups (our main use case)
- ✅ Caching layer (perfect for summaries, PDF chunks)
- ✅ < 10,000 documents (date range scan is fast enough)
- ✅ MVP/prototype stage
- ✅ Read-heavy workload (we are)
- ✅ Simple data model (flat documents)

**KV is great for:**
- Fast lookups by ID
- Caching expensive operations (summaries, PDF parsing)
- Session storage
- Rate limiting
- Simple counters

## When to Move to PostgreSQL (Vercel Postgres) 🔄

**Move to Postgres when you need:**

### 1. **Complex Queries**
```sql
-- Find all documents by department in date range
SELECT * FROM documents 
WHERE departement = 'Justisdepartementet' 
  AND date BETWEEN '2025-01-01' AND '2025-12-31'
ORDER BY date DESC;

-- Count documents by tema
SELECT tema, COUNT(*) 
FROM documents 
GROUP BY tema 
ORDER BY COUNT(*) DESC;

-- Find related documents
SELECT d1.*, d2.* 
FROM documents d1
JOIN sak_relasjoner sr ON d1.sak_id = sr.sak_id
JOIN documents d2 ON sr.relatert_sak_id = d2.sak_id;
```

### 2. **Full-Text Search**
```sql
-- Search across title, summary, fullText
SELECT * FROM documents
WHERE to_tsvector('norwegian', title || ' ' || full_text) 
      @@ to_tsquery('norwegian', 'næringspolitikk');
```

### 3. **Analytics & Reporting**
```sql
-- Documents per department over time
SELECT departement, DATE_TRUNC('month', date) as month, COUNT(*)
FROM documents
GROUP BY departement, month
ORDER BY month DESC, COUNT(*) DESC;
```

### 4. **Data Relationships**
- Documents → Publications → PDF Chunks
- Documents → Representatives → Parties
- Documents → Related Documents

### 5. **Data Integrity**
- Foreign key constraints
- Transactions (atomic updates)
- Data validation

### 6. **Better Performance at Scale**
- Indexes on multiple columns
- Query optimization
- Efficient joins

## Migration Path (Easy with Our Abstraction!)

**Good news:** Our `StorageAdapter` interface makes migration easy!

```typescript
// Just implement a new PostgresStorageAdapter
class PostgresStorageAdapter implements StorageAdapter {
  // Same interface, different implementation
  async getDocument(sakId: string): Promise<StortingetDocument | null> {
    const result = await db.query('SELECT * FROM documents WHERE sak_id = $1', [sakId]);
    return result.rows[0] ? this.mapRowToDocument(result.rows[0]) : null;
  }
  
  async getDocumentsByDateRange(start: Date, end: Date): Promise<StortingetDocument[]> {
    // Now we can use proper SQL with indexes!
    const result = await db.query(
      'SELECT * FROM documents WHERE date BETWEEN $1 AND $2 ORDER BY date DESC',
      [start, end]
    );
    return result.rows.map(this.mapRowToDocument);
  }
  
  // ... etc
}

// Switch implementation:
export function getStorage(): StorageAdapter {
  if (process.env.USE_POSTGRES === 'true') {
    return new PostgresStorageAdapter();
  }
  // ... existing logic
}
```

## Recommendation for Your MVP

### Phase 1: MVP (Current - Vercel KV) ✅
- **Use KV for now** - it's perfect for your current needs
- Simple, fast, cost-effective
- Works great for < 10,000 documents
- Easy to set up on Vercel

### Phase 2: Growth (Consider Postgres when...)
Move to **Vercel Postgres** when you need:
- 📊 Analytics dashboard ("Show me all documents by department")
- 🔍 Full-text search ("Find documents mentioning 'klima'")
- 📈 Complex reporting
- 🔗 Document relationships
- 📚 > 10,000 documents (date range scans get slow)

### Phase 3: Scale (If needed)
- Vector database for semantic search (Pinecone, Weaviate)
- Separate read replicas
- CDN for static content

## Cost Comparison (Vercel)

**Vercel KV (Redis):**
- Free tier: 256 MB storage, 30,000 requests/day
- Pro: $20/month - 1 GB, 1M requests/day
- Good for: Caching, simple lookups

**Vercel Postgres:**
- Free tier: 256 MB storage, 60 hours compute/month
- Pro: $20/month - 8 GB storage, unlimited compute
- Good for: Complex queries, relationships, analytics

## Hybrid Approach (Best of Both Worlds)

You could use **both**:
- **KV** for caching (summaries, PDF chunks) - fast lookups
- **Postgres** for documents - complex queries, relationships

```typescript
// Cache layer (KV)
const summary = await kv.get(`summary:${sakId}`);
if (summary) return summary;

// Source of truth (Postgres)
const doc = await db.getDocument(sakId);
const summary = await generateSummary(doc);
await kv.set(`summary:${sakId}`, summary); // Cache it
```

## Bottom Line

**For MVP:** ✅ **Stick with Vercel KV**
- Your current usage patterns are perfect for KV
- Simple, fast, cost-effective
- Easy migration path when needed

**Move to Postgres when:**
- You need analytics/reporting features
- You need full-text search
- You have > 10,000 documents
- You need complex queries

**The abstraction layer we built makes migration trivial** - just swap the implementation!

