# tinget.ai

AI-powered briefs, insights, and analysis for policymakers, politicians, and curious laypeople, based on documents from the Norwegian Parliament (Stortinget).

## Features

- **Daily Briefs**: Automatically fetches and summarizes documents from Stortinget from the last 7 days
- **Intelligent Chat**: Ask questions about cases, get analysis, and explore connections between documents
- **Rich Context**: Full document context including grunnlag (basis), referat (minutes), innstillingstekst (committee recommendations), and PDF content
- **Web Search Integration**: Find relevant Norwegian news articles about cases
- **Persistent Storage**: Uses Vercel KV (Redis) for fast loading and incremental updates
- **Smart Caching**: Reduces API calls and improves performance

## Tech Stack

- **Framework**: Next.js 15.5.6 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4o and GPT-4o-mini
- **Search**: Tavily API
- **Storage**: Vercel KV (Redis) in production, in-memory for local dev
- **PDF Processing**: pdf-parse for extracting text from PDFs

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key
- (Optional) Tavily API key for web search

### Installation

1. Clone the repository:
```bash
git clone https://github.com/pgrindehollevik-harvard/bigthing-morning-brief.git
cd bigthing-morning-brief
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file:
```env
OPENAI_API_KEY=your_openai_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here  # Optional, for web search
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

- `OPENAI_API_KEY` (required): Your OpenAI API key for AI summaries and chat
- `TAVILY_API_KEY` (optional): Tavily API key for web search functionality
- `KV_REST_API_URL` (production): Vercel KV REST API URL
- `KV_REST_API_TOKEN` (production): Vercel KV REST API token

## Deployment

### Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Custom Domain

To use a custom domain (e.g., `tinget.ai`):

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain
3. Follow Vercel's DNS instructions
4. Add DNS records at your domain registrar
5. Wait for DNS propagation

See `DOMAIN_SETUP.md` for detailed instructions.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/          # Chat API endpoint
│   │   ├── digest/        # Daily digest endpoint
│   │   ├── translate/     # Translation API (currently disabled)
│   │   └── test-storage/  # Storage testing endpoint
│   ├── components/
│   │   ├── ChatWindow.tsx # Chat interface component
│   │   └── MessageContent.tsx # Message rendering component
│   └── page.tsx           # Main page
├── lib/
│   ├── stortinget.ts      # Stortinget API integration
│   ├── openai.ts          # OpenAI summarization
│   ├── webSearch.ts       # Web search integration
│   ├── storage.ts         # Storage abstraction layer
│   └── pdfHandler.ts      # PDF processing
└── types/
    └── index.ts           # TypeScript type definitions
```

## Features in Detail

### Document Fetching

- Fetches documents from the last 7 days
- Incremental updates: only fetches new or updated documents
- Caches document list for 5 minutes to reduce API calls
- Stores full document context in Vercel KV

### AI Summarization

- Uses GPT-4o-mini for efficient summarization
- Includes full context: grunnlag, referat, innstillingstekst, fullText
- Generates professional, policy-focused summaries
- Follows Norwegian capitalization rules

### Chat Interface

- Context-aware suggested questions
- Full document context from storage
- PDF chunk retrieval for relevant documents
- Web search integration for Norwegian news
- Sources always cited at the end

### Storage

- **Production**: Vercel KV (Redis) for persistent storage
- **Local Dev**: In-memory storage with JSON file backup
- Stores: documents, summaries, PDF chunks
- Date-indexed for efficient queries

## API Endpoints

- `GET /api/digest` - Get daily digest of documents
- `POST /api/chat` - Chat with AI about cases
- `POST /api/translate` - Translate case content (currently disabled)
- `GET /api/test-storage` - Test storage functionality

## Development

### Local Development

- Uses in-memory storage (data saved to `.data/storage.json`)
- No Vercel KV required for local dev
- All features work locally except production storage

### Building

```bash
npm run build
npm start
```

## License

Private project.

## Contributing

This is a private project. For questions or issues, contact the repository owner.
