# Testing Storage Setup

## Quick Test

### Option 1: Test in Production (Easiest)

Since you just connected the database in Vercel, the env vars are already set in production:

1. **Deploy to Vercel** (if not already deployed):
   ```bash
   vercel --prod
   ```
   Or just push to main branch if auto-deploy is enabled.

2. **Visit the test endpoint**:
   ```
   https://your-app.vercel.app/api/test-storage
   ```

3. **Check the response** - should show:
   ```json
   {
     "storageType": "Vercel KV/Upstash Redis",
     "hasKvEnv": true,
     "tests": {
       "saveAndRetrieve": { "success": true },
       "saveAndRetrieveSummary": { "success": true },
       "dateRangeQuery": { "success": true },
       "pdfChunks": { "success": true }
     },
     "overall": { "status": "PASS" }
   }
   ```

### Option 2: Test Locally

To test locally, you need to add the env vars to `.env.local`:

1. **Get the env vars from Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Find `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - Copy the values

2. **Add to `.env.local`**:
   ```bash
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token-here
   ```

3. **Test locally**:
   ```bash
   npm run dev
   ```
   Then visit: `http://localhost:3001/api/test-storage`

### Option 3: Test the Full Flow

Test the actual digest endpoint:

1. **Visit**: `https://your-app.vercel.app/api/digest`
   - Should fetch documents and cache them
   - Check Vercel logs for: `[Storage] Using Vercel KV/Upstash Redis storage`

2. **Visit again** (should be faster - from cache):
   - Should use cached documents
   - Should use cached summaries

3. **Check storage**:
   - Visit: `https://your-app.vercel.app/api/test-storage`
   - Should show documents were saved

## What to Look For

✅ **Success indicators:**
- `"storageType": "Vercel KV/Upstash Redis"`
- `"hasKvEnv": true`
- All tests show `"success": true`
- Console shows: `[Storage] Using Vercel KV/Upstash Redis storage`

❌ **If it fails:**
- Check env vars are set in Vercel
- Check the database is connected in Vercel Storage tab
- Check Vercel logs for errors
- Verify the REST API URL and token are correct

## Next Steps After Testing

Once storage is working:
1. Documents will be cached (faster loading)
2. Summaries will be cached (fewer OpenAI calls)
3. PDF chunks will be cached (faster RAG)
4. Only new/updated documents will be fetched from Stortinget API

