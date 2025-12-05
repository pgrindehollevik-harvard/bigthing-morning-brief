import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

/**
 * Test endpoint to verify storage is working
 * 
 * GET /api/test-storage
 * 
 * Tests:
 * - Storage adapter type (KV vs in-memory)
 * - Save/retrieve document
 * - Save/retrieve summary
 * - Date range query
 */
export async function GET(request: Request) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      storageType: 'unknown',
      tests: {},
    };

    // Detect storage type
    const hasKvEnv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    results.storageType = hasKvEnv ? 'Vercel KV' : 'In-Memory';
    results.hasKvEnv = hasKvEnv;

    // Test 1: Save and retrieve a test document
    try {
      const testDoc = {
        sakId: 'test-123',
        title: 'Test Document',
        date: new Date().toISOString(),
        url: 'https://example.com/test',
        lastUpdated: new Date().toISOString(),
      };

      await storage.saveDocument(testDoc as any);
      const retrieved = await storage.getDocument('test-123');
      
      results.tests.saveAndRetrieve = {
        success: retrieved !== null && retrieved.sakId === 'test-123',
        saved: testDoc.sakId,
        retrieved: retrieved?.sakId || null,
      };
    } catch (error: any) {
      results.tests.saveAndRetrieve = {
        success: false,
        error: error.message,
      };
    }

    // Test 2: Save and retrieve a test summary
    try {
      const testSummary = {
        title: 'Test Summary',
        summary: 'This is a test summary',
        whyItMatters: 'Testing storage',
        url: 'https://example.com/test',
      };

      await storage.saveSummary('test-123', testSummary as any);
      const retrieved = await storage.getSummary('test-123');
      
      results.tests.saveAndRetrieveSummary = {
        success: retrieved !== null && retrieved.title === 'Test Summary',
        saved: testSummary.title,
        retrieved: retrieved?.title || null,
      };
    } catch (error: any) {
      results.tests.saveAndRetrieveSummary = {
        success: false,
        error: error.message,
      };
    }

    // Test 3: Date range query
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const docs = await storage.getDocumentsByDateRange(weekAgo, now);
      
      results.tests.dateRangeQuery = {
        success: true,
        count: docs.length,
        hasTestDoc: docs.some(d => d.sakId === 'test-123'),
      };
    } catch (error: any) {
      results.tests.dateRangeQuery = {
        success: false,
        error: error.message,
      };
    }

    // Test 4: PDF chunks
    try {
      const testChunks = ['Chunk 1', 'Chunk 2', 'Chunk 3'];
      await storage.savePdfChunks('test-pdf-123', testChunks);
      const retrieved = await storage.getPdfChunks('test-pdf-123');
      
      results.tests.pdfChunks = {
        success: retrieved !== null && retrieved.length === 3,
        saved: testChunks.length,
        retrieved: retrieved?.length || 0,
      };
    } catch (error: any) {
      results.tests.pdfChunks = {
        success: false,
        error: error.message,
      };
    }

    // Overall status
    const allTestsPassed = Object.values(results.tests).every((test: any) => test.success);
    results.overall = {
      status: allTestsPassed ? 'PASS' : 'FAIL',
      testsRun: Object.keys(results.tests).length,
      testsPassed: Object.values(results.tests).filter((test: any) => test.success).length,
    };

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Storage test failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

