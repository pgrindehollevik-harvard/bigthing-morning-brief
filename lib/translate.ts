/**
 * Translation utility for case content
 * Uses OpenAI to translate Norwegian text to English
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple cache for translations
const translationCache = new Map<string, string>();

export async function translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // Check cache first
  const cacheKey = `en:${text.substring(0, 100)}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for faster, cheaper translations
      messages: [
        {
          role: "system",
          content: "You are a professional translator. Translate the following Norwegian text to English. Maintain the same tone and style. Do not add explanations, just return the translation.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const translation = completion.choices[0]?.message?.content || text;
    
    // Cache the translation
    translationCache.set(cacheKey, translation);
    
    return translation;
  } catch (error) {
    console.error("Translation error:", error);
    // Return original text if translation fails
    return text;
  }
}

export async function translateCaseContent(
  item: { title: string; summary: string; whyItMatters: string; tema?: string },
  language: "no" | "en"
): Promise<{ title: string; summary: string; whyItMatters: string; tema?: string }> {
  if (language === "no") {
    return item; // Return original if Norwegian
  }

  // Translate all fields in parallel
  const [translatedTitle, translatedSummary, translatedWhyItMatters, translatedTema] = await Promise.all([
    translateToEnglish(item.title),
    translateToEnglish(item.summary),
    translateToEnglish(item.whyItMatters),
    item.tema ? translateToEnglish(item.tema) : Promise.resolve(item.tema),
  ]);

  return {
    title: translatedTitle,
    summary: translatedSummary,
    whyItMatters: translatedWhyItMatters,
    tema: translatedTema,
  };
}

