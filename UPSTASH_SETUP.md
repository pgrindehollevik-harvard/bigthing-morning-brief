# Upstash Redis Setup (Vercel Marketplace)

Since Vercel KV is now in the Marketplace, here's how to set it up with Upstash:

## Quick Setup

### 1. Create Upstash Redis Database

**Via Vercel Dashboard:**
1. Go to your project → **Storage** tab
2. Click **Create New** or **Browse Storage**
3. Select **Upstash** from Marketplace
4. Follow the wizard to create database
5. Name it (e.g., "tinget-storage")
6. Choose region and plan

**Via Upstash Console (Alternative):**
1. Go to [Upstash Console](https://console.upstash.com/)
2. Sign up/login
3. Create new Redis database
4. Choose region (same as your Vercel functions)
5. Copy REST API credentials

### 2. Get Connection Details

After creating the database, you'll get:
- **REST API URL**: `https://your-db.upstash.io`
- **REST API Token**: `your-token-here`

### 3. Add to Vercel Environment Variables

**Option A: Auto-added (if created via Vercel Marketplace)**
- Vercel may automatically add env vars
- Check: Project → Settings → Environment Variables

**Option B: Manual (if created via Upstash Console)**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - Name: `UPSTASH_REDIS_REST_URL`
   - Value: `https://your-db.upstash.io`
3. Add:
   - Name: `UPSTASH_REDIS_REST_TOKEN`
   - Value: `your-token-here`
4. Apply to: Production, Preview, Development (or just Production)

### 4. For Local Testing

Add to `.env.local`:
```bash
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### 5. Test

Run the test endpoint:
```bash
npm run dev
# Visit: http://localhost:3001/api/test-storage
```

## Free Tier Limits (Upstash)

- **10,000 commands/day** (plenty for MVP)
- **256 MB storage**
- **Global replication** (fast worldwide)

## Our Code Compatibility

Our storage code automatically detects:
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Vercel KV)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (Upstash)
- `REDIS_REST_API_URL` / `REDIS_REST_API_TOKEN` (Generic Redis)

So it works with any of these!

## Troubleshooting

**"Connection failed" error:**
- Check that env vars are set correctly
- Verify the REST API URL and token from Upstash console
- Make sure database is in same region as your functions

**"Rate limit exceeded":**
- You've hit the 10k commands/day limit
- Check usage in Upstash console
- Consider upgrading or optimizing queries

