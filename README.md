# Stortinget Daily Brief

A Next.js application that automatically fetches recent documents from the Norwegian Parliament (Stortinget), summarizes them using OpenAI, and displays a Norwegian-language daily brief for policymakers and lawmakers.

## Features

- 📄 **Automatic Document Fetching**: Retrieves recent documents from the Stortinget API (last 7 days)
- 🤖 **AI-Powered Summaries**: Uses OpenAI GPT-4o-mini to generate concise Norwegian summaries
- 🎨 **Party Color Coding**: Visual tags with official party colors for representatives
- 🏛️ **Source Attribution**: Shows department names for government proposals and individual representatives for member proposals
- 🔗 **Direct Links**: Quick access to original documents and representative profiles
- 💬 **AI Chat**: Interactive chat to analyze cases, find connections, and search for related news
- 📱 **Responsive Design**: Clean, modern UI built with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI API (GPT-4o-mini)
- **Data Source**: [Stortinget Open Data API](https://data.stortinget.no/)

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/bigthing-morning-brief.git
   cd bigthing-morning-brief
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   Create a `.env.local` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   STORTINGET_API_BASE=https://data.stortinget.no/eksport
   
   # Optional: Web search API (for chat feature)
   # See SEARCH_SETUP.md for details
   # TAVILY_API_KEY=your_tavily_key_here
   # or
   # SERPAPI_KEY=your_serpapi_key_here
   # or
   # GOOGLE_API_KEY=your_google_key_here
   # GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## How It Works

1. The app fetches recent documents from the Stortinget API (XML format)
2. Documents are parsed and filtered to the last 7 days
3. Each document is sent to OpenAI for summarization in Norwegian
4. Summaries include:
   - A brief overview (2-4 sentences)
   - "Hvorfor dette er viktig" (Why this is important) section
   - Source attribution (department or representatives)
5. Results are displayed in a clean, card-based interface

## Project Structure

```
├── app/
│   ├── api/
│   │   └── digest/          # API route for fetching and summarizing documents
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main page component
├── lib/
│   ├── openai.ts            # OpenAI integration
│   ├── partyColors.ts       # Party color mappings
│   └── stortinget.ts        # Stortinget API client
├── types/
│   └── index.ts             # TypeScript type definitions
└── ...
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |
| `STORTINGET_API_BASE` | Base URL for Stortinget API | No (defaults to `https://data.stortinget.no/eksport`) |

## Party Colors

The application uses official party colors for visual identification:

- **Arbeiderpartiet (Ap)**: Red
- **Høyre (H)**: Blue
- **Fremskrittspartiet (FrP)**: Cyan
- **Senterpartiet (Sp)**: Green
- **Kristelig Folkeparti (KrF)**: Yellow
- **Venstre (V)**: Emerald
- **Sosialistisk Venstreparti (SV)**: Dark Red
- **Miljøpartiet De Grønne (MDG)**: Lime Green
- **Rødt (R)**: Dark Red

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Notes

- The Stortinget API returns XML format, which is automatically parsed
- Documents are filtered to the last 7 days to ensure relevance
- The app handles missing or incomplete data gracefully
- All summaries are generated in Norwegian (Bokmål)

## License

This project is open source and available for use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [Stortinget](https://www.stortinget.no/) for providing open data
- [OpenAI](https://openai.com/) for the summarization API

