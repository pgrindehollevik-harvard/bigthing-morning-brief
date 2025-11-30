// Web search integration for chat
// Supports multiple search APIs:
// 1. Tavily API (https://tavily.com) - Recommended for AI applications
// 2. SerpAPI (https://serpapi.com) - Google search results
// 3. Google Custom Search API - Official Google API

export async function searchWeb(query: string, maxResults: number = 5): Promise<string> {
  // Try Tavily first (if API key is set)
  if (process.env.TAVILY_API_KEY) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: query,
          search_depth: "basic",
          max_results: maxResults,
          include_answer: true,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        let resultText = '';
        
        // Include answer if available
        if (data.answer) {
          resultText += `Svar: ${data.answer}\n\n`;
        }
        
        // Include results
        resultText += 'Kilder:\n';
        resultText += data.results
          .map((result: any, index: number) => 
            `${index + 1}. ${result.title}\n   ${result.content || result.snippet || ''}\n   ${result.url || ''}`
          )
          .join('\n\n');
        
        return resultText;
      }
    } catch (error) {
      console.error('Tavily search error:', error);
      // Fall through to try other APIs or return empty
    }
  }

  // Try SerpAPI (if API key is set)
  if (process.env.SERPAPI_KEY) {
    try {
      const response = await fetch(
        `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY}&num=${maxResults}`
      );

      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.organic_results && data.organic_results.length > 0) {
        return 'Kilder:\n' + data.organic_results
          .map((result: any, index: number) => 
            `${index + 1}. ${result.title}\n   ${result.snippet || ''}\n   ${result.link || ''}`
          )
          .join('\n\n');
      }
    } catch (error) {
      console.error('SerpAPI search error:', error);
      // Fall through
    }
  }

  // Try Google Custom Search (if API key and search engine ID are set)
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=${maxResults}`
      );

      if (!response.ok) {
        throw new Error(`Google Custom Search error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        return 'Kilder:\n' + data.items
          .map((item: any, index: number) => 
            `${index + 1}. ${item.title}\n   ${item.snippet || ''}\n   ${item.link || ''}`
          )
          .join('\n\n');
      }
    } catch (error) {
      console.error('Google Custom Search error:', error);
    }
  }

  // If no API keys are configured, return helpful message
  if (!process.env.TAVILY_API_KEY && !process.env.SERPAPI_KEY && !process.env.GOOGLE_API_KEY) {
    return `[Web search ikke konfigurert. Legg til en API-nøkkel i .env.local:
- TAVILY_API_KEY (anbefalt, hent fra https://tavily.com)
- eller SERPAPI_KEY (hent fra https://serpapi.com)
- eller GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID (hent fra Google Cloud Console)]`;
  }

  return '';
}

