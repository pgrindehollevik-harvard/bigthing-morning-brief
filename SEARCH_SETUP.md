# Web Search API Setup

For the chat feature to search the web for related news and information, you need to configure a search API. Here are the options:

## Option 1: Tavily API (Recommended) ⭐

**Best for AI applications** - Designed specifically for LLM use cases.

### Steps:
1. Sign up at [https://tavily.com](https://tavily.com)
2. Get your API key from the dashboard
3. Add to `.env.local`:
   ```
   TAVILY_API_KEY=your_api_key_here
   ```

**Pricing**: Free tier available, then pay-as-you-go

---

## Option 2: SerpAPI

**Best for Google search results** - Provides real Google search results.

### Steps:
1. Sign up at [https://serpapi.com](https://serpapi.com)
2. Get your API key from the dashboard
3. Add to `.env.local`:
   ```
   SERPAPI_KEY=your_api_key_here
   ```

**Pricing**: 100 free searches/month, then paid plans

---

## Option 3: Google Custom Search API

**Official Google API** - Requires more setup but uses official Google infrastructure.

### Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable "Custom Search API"
4. Create credentials (API Key)
5. Set up a Custom Search Engine at [https://programmablesearchengine.google.com/](https://programmablesearchengine.google.com/)
6. Get your Search Engine ID
7. Add to `.env.local`:
   ```
   GOOGLE_API_KEY=your_api_key_here
   GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
   ```

**Pricing**: 100 free searches/day, then $5 per 1000 queries

---

## Which one to choose?

- **Tavily**: Easiest setup, designed for AI, good for Norwegian content
- **SerpAPI**: Best if you want actual Google results
- **Google Custom Search**: Most control, official Google API

The code will automatically use whichever API key you provide. If you provide multiple, it will try them in order: Tavily → SerpAPI → Google Custom Search.

---

## Testing

After adding your API key:
1. Restart your dev server (`npm run dev`)
2. Open the chat
3. Ask a question that requires web search, like:
   - "Finn nyheter om [topic]"
   - "Hva skjer med [topic] i Norge?"
   - "Søk etter oppdatert informasjon om [topic]"

The chat will automatically detect when web search is needed and use your configured API.

