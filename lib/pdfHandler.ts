/**
 * PDF fetching and processing
 * 
 * Fetches PDFs from Stortinget API using eksport_id
 * Parses PDFs and chunks them for RAG (Retrieval Augmented Generation)
 */

const STORTINGET_API_BASE = "https://data.stortinget.no/eksport";

interface PdfChunk {
  text: string;
  page?: number;
  chunkIndex: number;
}

/**
 * Fetch PDF content from Stortinget API using eksport_id
 * Returns the PDF as a Buffer
 */
export async function fetchPdf(eksportId: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    // Try to fetch PDF - the endpoint might be /publikasjon/{eksport_id} or similar
    // We'll need to check the actual API structure
    const response = await fetch(`${STORTINGET_API_BASE}/publikasjon/${eksportId}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/pdf, application/xml, */*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`Failed to fetch PDF ${eksportId}: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type');
    
    // If it's XML, we need to extract the PDF URL from it
    if (contentType?.includes('xml')) {
      const xmlText = await response.text();
      // Parse XML to find PDF URL
      // This structure might vary - we'll need to check the actual response
      const pdfUrlMatch = xmlText.match(/<pdf_url[^>]*>([^<]+)<\/pdf_url>/i) ||
                          xmlText.match(/<fil_url[^>]*>([^<]+)<\/fil_url>/i);
      
      if (pdfUrlMatch) {
        const pdfUrl = pdfUrlMatch[1].trim();
        // Fetch the actual PDF
        const pdfResponse = await fetch(pdfUrl.startsWith('http') ? pdfUrl : `https://www.stortinget.no${pdfUrl}`, {
          signal: controller.signal,
        });
        
        if (pdfResponse.ok) {
          return Buffer.from(await pdfResponse.arrayBuffer());
        }
      }
      
      // If no PDF URL found, return null
      return null;
    }
    
    // If it's already a PDF, return it
    if (contentType?.includes('pdf')) {
      return Buffer.from(await response.arrayBuffer());
    }
    
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`Timeout fetching PDF ${eksportId}`);
    } else {
      console.error(`Error fetching PDF ${eksportId}:`, error);
    }
    return null;
  }
}

/**
 * Parse PDF and extract text
 * Uses pdf-parse library
 */
export async function parsePdf(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid issues if pdf-parse isn't installed
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(pdfBuffer);
    return data.text || '';
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF. Install pdf-parse: npm install pdf-parse');
  }
}

/**
 * Chunk text for RAG (Retrieval Augmented Generation)
 * 
 * Strategy:
 * 1. Split by paragraphs first (natural breaks)
 * 2. If chunks are too large, split by sentences
 * 3. If chunks are too small, combine with next chunk
 * 4. Maintain overlap between chunks for context
 * 
 * @param text - The text to chunk
 * @param chunkSize - Target chunk size in characters (default: 1000)
 * @param overlap - Overlap between chunks in characters (default: 200)
 * @returns Array of text chunks
 */
export function chunkTextForRAG(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    
    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + trimmedPara.length + 1 > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + trimmedPara;
      } else {
        currentChunk = trimmedPara;
      }
    } else {
      // Add paragraph to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + trimmedPara;
      } else {
        currentChunk = trimmedPara;
      }
    }
    
    // If a single paragraph is too large, split it by sentences
    if (currentChunk.length > chunkSize * 1.5) {
      const sentences = currentChunk.split(/(?<=[.!?])\s+/);
      let sentenceChunk = '';
      
      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length + 1 > chunkSize && sentenceChunk.length > 0) {
          chunks.push(sentenceChunk.trim());
          
          // Overlap with last few sentences
          if (overlap > 0) {
            const lastSentences = sentenceChunk.split(/(?<=[.!?])\s+/).slice(-2).join(' ');
            sentenceChunk = lastSentences + ' ' + sentence;
          } else {
            sentenceChunk = sentence;
          }
        } else {
          sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
        }
      }
      
      currentChunk = sentenceChunk;
    }
  }
  
  // Add remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  // Filter out very small chunks (less than 50 chars) unless it's the only chunk
  if (chunks.length > 1) {
    return chunks.filter(chunk => chunk.length >= 50);
  }
  
  return chunks;
}

/**
 * Fetch, parse, and chunk a PDF
 * Returns the chunks ready for RAG
 */
export async function fetchAndChunkPdf(eksportId: string): Promise<string[]> {
  try {
    // Check if we already have chunks cached
    const { storage } = await import('./storage');
    const cachedChunks = await storage.getPdfChunks(eksportId);
    if (cachedChunks && cachedChunks.length > 0) {
      return cachedChunks;
    }
    
    // Fetch PDF
    const pdfBuffer = await fetchPdf(eksportId);
    if (!pdfBuffer) {
      console.warn(`Could not fetch PDF for ${eksportId}`);
      return [];
    }
    
    // Parse PDF
    const text = await parsePdf(pdfBuffer);
    if (!text || text.trim().length === 0) {
      console.warn(`PDF ${eksportId} has no extractable text`);
      return [];
    }
    
    // Chunk text
    const chunks = chunkTextForRAG(text, 1000, 200);
    
    // Cache chunks
    if (chunks.length > 0) {
      await storage.savePdfChunks(eksportId, chunks);
    }
    
    return chunks;
  } catch (error) {
    console.error(`Error processing PDF ${eksportId}:`, error);
    return [];
  }
}

/**
 * Get relevant PDF chunks for a query (simple keyword matching for MVP)
 * In a full RAG system, you'd use embeddings and vector search
 */
export async function getRelevantPdfChunks(
  eksportIds: string[],
  query: string
): Promise<string[]> {
  const relevantChunks: string[] = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
  
  for (const eksportId of eksportIds) {
    const chunks = await fetchAndChunkPdf(eksportId);
    
    for (const chunk of chunks) {
      const chunkLower = chunk.toLowerCase();
      // Simple relevance: count how many query terms appear in chunk
      const relevance = queryTerms.reduce((score, term) => {
        return score + (chunkLower.includes(term) ? 1 : 0);
      }, 0);
      
      if (relevance > 0) {
        relevantChunks.push(chunk);
      }
    }
  }
  
  // Sort by relevance (simple: more query terms = more relevant)
  // Limit to top 10 chunks to avoid token limits
  return relevantChunks.slice(0, 10);
}

