# MVP_PLAN.md

## Stortinget Morning Brief — MVP Specification

### Goal
Build a minimal MVP that automatically fetches recent public documents from the Norwegian parliament (Stortinget), summarizes them using an LLM, and displays a Norwegian-language morning brief in a simple web UI.

The objective is speed: functional, not polished.

---

## Core Features

### 1. API Route: `/api/digest`
Create a Next.js API route that:

- Fetches a small number (3–5) of recent Stortinget documents from the last 24 hours  
- Extracts fields including:  
  - title  
  - publication date  
  - URL  
  - text/content  
- Passes these documents to an LLM for summarization  
- Returns a JSON payload shaped like:

```json
{
  "date": "2025-11-30",
  "items": [
    {
      "title": "…",
      "summary": "…",
      "whyItMatters": "…",
      "url": "…"
    }
  ]
}

2. LLM Summaries

Implement server-side summarization that:
	•	Takes raw text from the documents
	•	Produces 2–4 sentence Norwegian summaries
	•	Adds 1–2 bullets under “Hvorfor dette er viktig”
	•	Uses the OpenAI API (Responses / Chat Completions) with your API key
	•	Is robust to incomplete or messy text

A simple starting prompt:

Oppgave: Du får noen offentlige dokumenter fra Stortinget.
Lag en kort norsk oppsummering for hvert dokument (2–4 setninger), og legg til 1–2 punkter om “Hvorfor dette er viktig”.
Svar i ren JSON med feltene: title, summary, whyItMatters, url.

3. Frontend: /

Build a minimal UI using Next.js + Tailwind:
	•	Call /api/digest on page load
	•	Render the morning brief
	•	Each item shows:
	•	title
	•	summary
	•	“Hvorfor dette er viktig”
	•	link to the original Stortinget document
	•	Style with simple card components

4. Scope Constraints

To keep the MVP small and finishable in under an hour:
	•	No authentication
	•	No database
	•	No caching
	•	No complex error handling
	•	Only fetch a few documents initially
	•	Use mock data temporarily if the API slows you down

⸻

Tech Stack
	•	Next.js (App Router)
	•	TypeScript
	•	Tailwind
	•	OpenAI API
	•	Fetching from Stortinget open-data API
	•	Minimal server-side logic in API routes

⸻

Data Source

Start with any Stortinget open-data endpoint that returns recent cases (“saker”) or documents.

Examples:

https://data.stortinget.no/eksport/saker

The endpoint can be refined later — the goal is to get something working quickly.

⸻

Output Requirements

Each document summary must include:
	•	Title
	•	Short summary (2–4 sentences)
	•	Hvorfor dette er viktig (1–2 bullets)
	•	Source URL

All text should be in Norwegian.

⸻

MVP Goal

Produce a working webpage that generates a single Norwegian-language morning brief based on the latest Stortinget documents.

This MVP does not need to be perfect — it only needs to demonstrate the core idea end-to-end so it can be shown to real users.

⸻
