# Setting up tinget.ai Domain on Vercel

## Steps to Add Custom Domain

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Select your project: `bigthing-morning-brief`

2. **Navigate to Domain Settings**
   - Click on your project
   - Go to **Settings** tab
   - Click on **Domains** in the left sidebar

3. **Add Your Domain**
   - Click **Add** or **Add Domain** button
   - Enter `tinget.ai`
   - Click **Add**

4. **Configure DNS Records**
   Vercel will show you the DNS records you need to add. You'll need to add these at your domain registrar (where you bought tinget.ai):

   **Option A: Root Domain (tinget.ai)**
   - Type: `A`
   - Name: `@` or leave blank
   - Value: `76.76.21.21` (Vercel's IP - check Vercel dashboard for current value)
   
   **OR use CNAME:**
   - Type: `CNAME`
   - Name: `@` or leave blank
   - Value: `cname.vercel-dns.com` (check Vercel dashboard for exact value)

   **Option B: Subdomain (www.tinget.ai)**
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com` (check Vercel dashboard for exact value)

5. **Wait for DNS Propagation**
   - DNS changes can take a few minutes to 48 hours
   - Vercel will show the status in the dashboard
   - Once it shows "Valid Configuration", your domain is ready!

6. **SSL Certificate**
   - Vercel automatically provisions SSL certificates
   - Your site will be available at `https://tinget.ai`

## Common Domain Registrars

If you bought the domain from:
- **Namecheap**: Go to Domain List → Manage → Advanced DNS
- **GoDaddy**: Go to My Products → DNS → Manage Zones
- **Google Domains**: Go to DNS → Custom records
- **Cloudflare**: Go to DNS → Records

## Verify Setup

Once configured, you can verify by:
1. Checking Vercel dashboard - domain should show "Valid Configuration"
2. Visiting https://tinget.ai in your browser
3. The site should load (may take a few minutes after DNS propagation)

## Troubleshooting

- **DNS not propagating**: Wait up to 48 hours, or check with your registrar
- **SSL certificate issues**: Vercel handles this automatically, but may take a few minutes
- **Domain not working**: Check DNS records match exactly what Vercel shows

