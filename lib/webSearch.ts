// Web search integration for chat
// Supports multiple search APIs:
// 1. Tavily API (https://tavily.com) - Recommended for AI applications
// 2. SerpAPI (https://serpapi.com) - Google search results
// 3. Google Custom Search API - Official Google API

export async function searchWeb(query: string, maxResults: number = 5): Promise<string> {
  // Try Tavily first (if API key is set)
  const tavilyKey = process.env.TAVILY_API_KEY;
  console.log('Tavily API key exists:', !!tavilyKey, 'Length:', tavilyKey?.length || 0);
  
  if (tavilyKey) {
    try {
      // Add current year to query to prioritize recent results
      const currentYear = new Date().getFullYear();
      const enhancedQuery = `${query} ${currentYear} nylig`;
      
      console.log('Calling Tavily API with query:', enhancedQuery);
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: enhancedQuery,
          search_depth: "advanced", // Use advanced for better recency
          max_results: maxResults,
          include_answer: true,
          include_raw_content: false,
          topic: "news", // Specify news topic for better recency
          days: 30, // Only search last 30 days
        }),
      });

      console.log('Tavily response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tavily API error response:', errorText);
        throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Tavily response data keys:', Object.keys(data));
      console.log('Tavily results count:', data.results?.length || 0);
      
      if (data.results && data.results.length > 0) {
        // Filter and sort results by recency (if published_date is available)
        const sortedResults = data.results
          .map((result: any) => {
            // Try to extract date from published_date or content
            let date: Date | null = null;
            if (result.published_date) {
              date = new Date(result.published_date);
            } else if (result.content) {
              // Try to find date patterns in content (Norwegian format)
              const dateMatch = result.content.match(/\d{1,2}\.\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*\d{4}/i);
              if (dateMatch) {
                // Norwegian date format - parse it
                const months: Record<string, number> = {
                  januar: 0, februar: 1, mars: 2, april: 3, mai: 4, juni: 5,
                  juli: 6, august: 7, september: 8, oktober: 9, november: 10, desember: 11
                };
                const parts = dateMatch[0].match(/(\d{1,2})\.\s*(\w+)\s*(\d{4})/i);
                if (parts) {
                  const day = parseInt(parts[1]);
                  const month = months[parts[2].toLowerCase()];
                  const year = parseInt(parts[3]);
                  if (month !== undefined) {
                    date = new Date(year, month, day);
                  }
                }
              }
            }
            return { ...result, parsedDate: date };
          })
          .sort((a: any, b: any) => {
            // Sort by date (most recent first), or by relevance if no date
            if (a.parsedDate && b.parsedDate) {
              return b.parsedDate.getTime() - a.parsedDate.getTime();
            }
            if (a.parsedDate) return -1;
            if (b.parsedDate) return 1;
            return 0; // Keep original order if no dates
          })
          .slice(0, maxResults); // Take top results
        
        let resultText = '';
        
        // Include answer if available
        if (data.answer) {
          resultText += `Svar: ${data.answer}\n\n`;
        }
        
        // Include results with date info if available
        resultText += 'Kilder (sortert etter nylighet):\n';
        resultText += sortedResults
          .map((result: any, index: number) => {
            const dateStr = result.parsedDate 
              ? ` [${result.parsedDate.toLocaleDateString('no-NO', { year: 'numeric', month: 'short', day: 'numeric' })}]`
              : '';
            return `${index + 1}. ${result.title}${dateStr}\n   ${result.content || result.snippet || ''}\n   ${result.url || ''}`;
          })
          .join('\n\n');
        
        console.log('Returning search results, length:', resultText.length);
        console.log('Results sorted by recency');
        return resultText;
      } else {
        console.log('Tavily returned no results');
      }
    } catch (error) {
      console.error('Tavily search error:', error);
      // Fall through to try other APIs or return empty
    }
  } else {
    console.log('TAVILY_API_KEY not found in environment');
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

