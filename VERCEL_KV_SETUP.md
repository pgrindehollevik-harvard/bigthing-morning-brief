# Vercel KV Setup Guide

## Quick Setup

### 1. Install Package (Already Done ✅)
```bash
npm install @vercel/kv
```

### 2. Create KV Database in Vercel

**Important:** Vercel KV is now available through the Marketplace, not as built-in storage.

**Option A: Via Vercel Dashboard (Recommended)**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Storage** tab
4. Click **Create New** or **Browse Storage**
5. In the Marketplace section, select **Upstash** (Serverless Redis/KV)
   - Or choose **Redis** (Serverless Redis)
6. Follow the setup wizard:
   - Name it (e.g., "tinget-storage")
   - Select region (choose closest to your users)
   - Choose plan (Free tier available)
7. Click **Create** or **Continue**

**Option B: Direct Upstash Setup**
1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Copy the REST API URL and token
4. Add to Vercel environment variables manually

### 3. Environment Variables

**If using Marketplace provider (Upstash/Redis):**
The provider may auto-add env vars, or you may need to add them manually:

1. Go to your Marketplace database (Upstash/Redis) in Vercel
2. Find the **Connection** or **.env** section
3. Copy the values:
   - `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL`
   - `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN`

4. Add to Vercel project:
   - Go to your project → Settings → Environment Variables
   - Add the variables (or they may be auto-added)

**Note:** We need to map these to `KV_REST_API_URL` and `KV_REST_API_TOKEN` for our code to work.

### 4. Local Testing

To test locally, you need to add these to `.env.local`:

```bash
# Get these from Vercel Dashboard → Your Project → Storage → KV Database → .env.local
KV_REST_API_URL=https://your-kv-database.vercel-storage.com
KV_REST_API_TOKEN=your-token-here
```

**How to get the values:**
1. Go to Vercel Dashboard → Your Project → Storage
2. Click on your KV database
3. Click **.env.local** tab
4. Copy the values to your local `.env.local` file

### 5. Test the Setup

**Test locally:**
```bash
npm run dev
```

Then visit: `http://localhost:3001/api/digest`

Check the console/logs:
- Should see: "Using Vercel KV storage" (if env vars are set)
- Or: "Vercel KV not available, falling back to in-memory storage" (if not set)

**Test in production:**
1. Deploy to Vercel: `vercel --prod`
2. Visit your deployed site
3. Check Vercel logs for any errors

## How It Works

### Storage Structure

**Documents:**
- Key: `doc:{sakId}`
- Value: Full `StortingetDocument` object

**Summaries:**
- Key: `summary:{sakId}`
- Value: `DigestItem` object

**PDF Chunks:**
- Key: `pdf:{eksportId}`
- Value: Array of text chunks

**Date Index (for efficient range queries):**
- Key: `docs:date:YYYY-MM-DD`
- Value: Set of sakIds for that date
- Example: `docs:date:2025-12-05` → Set of sakIds

### Benefits

1. **Fast lookups**: O(1) by sakId
2. **Efficient date queries**: Uses date indexes (no full scan)
3. **Automatic expiration**: Date indexes expire after 30 days
4. **Serverless-friendly**: Works in Vercel serverless functions
5. **Scalable**: Handles millions of keys

## Monitoring

**Check usage in Vercel Dashboard:**
- Go to Storage → Your KV Database
- See: Storage used, Requests, etc.

**Free Tier Limits:**
- 256 MB storage
- 30,000 requests/day
- Should be plenty for MVP!

## Troubleshooting

**"Vercel KV not available" error:**
- Check that `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
- Verify in Vercel Dashboard → Settings → Environment Variables
- For local: Check `.env.local` file

**"Connection timeout" error:**
- Check your network/firewall
- Verify KV database is in same region as your functions

**"Rate limit exceeded":**
- You're hitting the free tier limit (30k requests/day)
- Consider upgrading or optimizing (caching, etc.)

## Migration from In-Memory

The code automatically switches:
- **Local dev (no env vars)**: Uses in-memory storage
- **Production (with env vars)**: Uses Vercel KV

No code changes needed! Just set the environment variables.

