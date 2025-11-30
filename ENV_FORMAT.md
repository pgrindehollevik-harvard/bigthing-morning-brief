# Environment Variable Format

## Correct Format

In `.env.local`, your API keys should be formatted like this:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
TAVILY_API_KEY=tvly-xxxxxxxxxxxxx
```

**Important:**
- ✅ No quotes around the values
- ✅ No spaces around the `=` sign
- ✅ No trailing spaces
- ✅ Each key on its own line

## Wrong Formats (Don't Use These)

```env
# ❌ WRONG - Quotes around value
TAVILY_API_KEY="tvly-xxxxxxxxxxxxx"

# ❌ WRONG - Spaces around =
TAVILY_API_KEY = tvly-xxxxxxxxxxxxx

# ❌ WRONG - Trailing space
TAVILY_API_KEY=tvly-xxxxxxxxxxxxx 
```

## Verification

After adding your keys:
1. Save the file
2. **Restart your dev server** (Ctrl+C, then `npm run dev`)
3. Check the terminal logs - you should see:
   - "Tavily API key exists: true"
   - "Tavily API key length: [number]"

If you see "Tavily API key exists: false" in the logs, the key isn't being read correctly.

