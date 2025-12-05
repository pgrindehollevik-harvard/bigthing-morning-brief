/**
 * Storage abstraction layer
 * 
 * For production (Vercel): Uses Vercel KV (Redis)
 * For local dev: Uses in-memory cache + optional JSON file backup
 * 
 * This allows us to:
 * 1. Store full StortingetDocument objects
 * 2. Store DigestItem summaries
 * 3. Store PDF chunks for RAG
 * 4. Fast incremental updates (only fetch new/updated documents)
 */

import { StortingetDocument, DigestItem } from "@/types";

// Storage interface
interface StorageAdapter {
  getDocument(sakId: string): Promise<StortingetDocument | null>;
  saveDocument(doc: StortingetDocument): Promise<void>;
  getDocumentsByDateRange(startDate: Date, endDate: Date): Promise<StortingetDocument[]>;
  getSummary(sakId: string): Promise<DigestItem | null>;
  saveSummary(sakId: string, summary: DigestItem): Promise<void>;
  getPdfChunks(eksportId: string): Promise<string[] | null>;
  savePdfChunks(eksportId: string, chunks: string[]): Promise<void>;
}

// In-memory storage for local dev (with optional JSON file backup)
class InMemoryStorage implements StorageAdapter {
  private documents = new Map<string, StortingetDocument>();
  private summaries = new Map<string, DigestItem>();
  private pdfChunks = new Map<string, string[]>();
  private filePath = ".data/storage.json";

  async getDocument(sakId: string): Promise<StortingetDocument | null> {
    return this.documents.get(sakId) || null;
  }

  async saveDocument(doc: StortingetDocument): Promise<void> {
    if (!doc.sakId) return;
    this.documents.set(doc.sakId, doc);
    await this.persistToFile();
  }

  async getDocumentsByDateRange(startDate: Date, endDate: Date): Promise<StortingetDocument[]> {
    const docs: StortingetDocument[] = [];
    for (const doc of this.documents.values()) {
      const docDate = new Date(doc.date);
      if (docDate >= startDate && docDate <= endDate) {
        docs.push(doc);
      }
    }
    return docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getSummary(sakId: string): Promise<DigestItem | null> {
    return this.summaries.get(sakId) || null;
  }

  async saveSummary(sakId: string, summary: DigestItem): Promise<void> {
    this.summaries.set(sakId, summary);
    await this.persistToFile();
  }

  async getPdfChunks(eksportId: string): Promise<string[] | null> {
    return this.pdfChunks.get(eksportId) || null;
  }

  async savePdfChunks(eksportId: string, chunks: string[]): Promise<void> {
    this.pdfChunks.set(eksportId, chunks);
    await this.persistToFile();
  }

  private async persistToFile(): Promise<void> {
    // Only in Node.js environment (not in browser)
    if (typeof window !== 'undefined') return;
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const data = {
        documents: Array.from(this.documents.entries()),
        summaries: Array.from(this.summaries.entries()),
        pdfChunks: Array.from(this.pdfChunks.entries()),
        timestamp: new Date().toISOString(),
      };
      
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      // Silently fail - file persistence is optional
      console.warn('Failed to persist storage to file:', error);
    }
  }

  async loadFromFile(): Promise<void> {
    if (typeof window !== 'undefined') return;
    
    try {
      const fs = await import('fs/promises');
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf-8'));
      
      this.documents = new Map(data.documents || []);
      this.summaries = new Map(data.summaries || []);
      this.pdfChunks = new Map(data.pdfChunks || []);
    } catch (error) {
      // File doesn't exist yet, start fresh
    }
  }
}

// Vercel KV storage for production
class VercelKVStorage implements StorageAdapter {
  private kv: any;

  constructor() {
    try {
      // Import @vercel/kv - it handles env vars automatically
      const { kv } = require('@vercel/kv');
      this.kv = kv;
    } catch (error) {
      throw new Error('Vercel KV not available. Install @vercel/kv and set KV_REST_API_URL and KV_REST_API_TOKEN.');
    }
  }

  private docKey(sakId: string): string {
    return `doc:${sakId}`;
  }

  private summaryKey(sakId: string): string {
    return `summary:${sakId}`;
  }

  private pdfChunksKey(eksportId: string): string {
    return `pdf:${eksportId}`;
  }

  private dateIndexKey(date: string): string {
    // Format: YYYY-MM-DD
    return `docs:date:${date}`;
  }

  async getDocument(sakId: string): Promise<StortingetDocument | null> {
    const data = await this.kv.get(this.docKey(sakId));
    // @vercel/kv automatically handles JSON, but we'll be explicit
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  }

  async saveDocument(doc: StortingetDocument): Promise<void> {
    if (!doc.sakId) return;
    
    // Save document
    await this.kv.set(this.docKey(doc.sakId), doc);
    
    // Maintain date index for efficient range queries
    const dateStr = doc.date.split('T')[0]; // YYYY-MM-DD
    const dateIndexKey = this.dateIndexKey(dateStr);
    
    // Add sakId to the date index (use a set)
    await this.kv.sadd(dateIndexKey, doc.sakId);
    
    // Set expiration on date index (keep for 30 days)
    await this.kv.expire(dateIndexKey, 30 * 24 * 60 * 60);
  }

  async getDocumentsByDateRange(startDate: Date, endDate: Date): Promise<StortingetDocument[]> {
    const docs: StortingetDocument[] = [];
    const currentDate = new Date(startDate);
    
    // Iterate through each date in range and get documents from index
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dateIndexKey = this.dateIndexKey(dateStr);
      
      // Get all sakIds for this date
      const sakIds = await this.kv.smembers(dateIndexKey);
      
      if (sakIds && sakIds.length > 0) {
        // Fetch all documents for this date in parallel
        const dateDocs = await Promise.all(
          sakIds.map((sakId: string) => this.getDocument(sakId))
        );
        
        // Filter out nulls and add to results
        docs.push(...dateDocs.filter((doc): doc is StortingetDocument => doc !== null));
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Sort by date descending
    return docs.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }

  async getSummary(sakId: string): Promise<DigestItem | null> {
    const data = await this.kv.get(this.summaryKey(sakId));
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  }

  async saveSummary(sakId: string, summary: DigestItem): Promise<void> {
    await this.kv.set(this.summaryKey(sakId), summary);
  }

  async getPdfChunks(eksportId: string): Promise<string[] | null> {
    const data = await this.kv.get(this.pdfChunksKey(eksportId));
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  }

  async savePdfChunks(eksportId: string, chunks: string[]): Promise<void> {
    await this.kv.set(this.pdfChunksKey(eksportId), chunks);
  }
}

// Factory function to get the right storage adapter
let storageInstance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (storageInstance) return storageInstance;

  // Use Vercel KV/Upstash Redis in production if available
  // Support multiple env var names (Vercel KV, Upstash, custom prefixes, etc.)
  const kvUrl = process.env.KV_REST_API_URL || 
                process.env.UPSTASH_REDIS_REST_URL ||
                process.env.REDIS_REST_API_URL ||
                process.env.STORAGE_URL || // Custom prefix from Vercel Marketplace
                process.env.STORAGE_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || 
                  process.env.UPSTASH_REDIS_REST_TOKEN ||
                  process.env.REDIS_REST_API_TOKEN ||
                  process.env.STORAGE_TOKEN || // Custom prefix from Vercel Marketplace
                  process.env.STORAGE_REST_TOKEN;
  
  if (kvUrl && kvToken) {
    // Set the env vars that @vercel/kv expects
    if (!process.env.KV_REST_API_URL) process.env.KV_REST_API_URL = kvUrl;
    if (!process.env.KV_REST_API_TOKEN) process.env.KV_REST_API_TOKEN = kvToken;
    
    try {
      storageInstance = new VercelKVStorage();
      console.log('[Storage] Using Vercel KV/Upstash Redis storage');
      return storageInstance;
    } catch (error: any) {
      console.warn('[Storage] KV/Redis not available, falling back to in-memory storage:', error.message);
    }
  } else {
    console.log('[Storage] KV/Redis env vars not set, using in-memory storage');
  }

  // Fall back to in-memory storage for local dev
  storageInstance = new InMemoryStorage();
  // Try to load from file if it exists
  if (storageInstance instanceof InMemoryStorage) {
    storageInstance.loadFromFile().catch(() => {});
  }
  return storageInstance;
}

// Convenience functions
export const storage = {
  getDocument: (sakId: string) => getStorage().getDocument(sakId),
  saveDocument: (doc: StortingetDocument) => getStorage().saveDocument(doc),
  getDocumentsByDateRange: (start: Date, end: Date) => getStorage().getDocumentsByDateRange(start, end),
  getSummary: (sakId: string) => getStorage().getSummary(sakId),
  saveSummary: (sakId: string, summary: DigestItem) => getStorage().saveSummary(sakId, summary),
  getPdfChunks: (eksportId: string) => getStorage().getPdfChunks(eksportId),
  savePdfChunks: (eksportId: string, chunks: string[]) => getStorage().savePdfChunks(eksportId, chunks),
};

