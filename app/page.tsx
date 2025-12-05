"use client";

import { useEffect, useState, useRef } from "react";
import { DigestResponse, DigestItem } from "@/types";
import { getPartyColors } from "@/lib/partyColors";
import ChatWindow from "./components/ChatWindow";

// Translation keys
const translations = {
  no: {
    loading: "Laster dagens oppsummering...",
    error: "Feil:",
    tryAgain: "Prøv igjen",
    noDocuments: "Ingen nye dokumenter de siste 7 dagene.",
    whyImportant: "Hvorfor dette er viktig:",
    readFull: "Les hele dokumentet →",
    addToChat: "+ Legg til i chat",
    inChat: "✓ I chat",
    updated: "Oppdatert:",
    refresh: "Oppdater",
    refreshing: "Oppdaterer...",
    chat: "Chat",
    cases: "saker",
    case: "sak",
    inContext: "i kontekst",
  },
  en: {
    loading: "Loading today's summary...",
    error: "Error:",
    tryAgain: "Try again",
    noDocuments: "No new documents in the last 7 days.",
    whyImportant: "Why this matters:",
    readFull: "Read full document →",
    addToChat: "+ Add to chat",
    inChat: "✓ In chat",
    updated: "Updated:",
    refresh: "Refresh",
    refreshing: "Refreshing...",
    chat: "Chat",
    cases: "cases",
    case: "case",
    inContext: "in context",
  },
};

export default function Home() {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [casesInChat, setCasesInChat] = useState<DigestItem[]>([]);
  const [chatWidth, setChatWidth] = useState(50); // Percentage width
  const [isResizing, setIsResizing] = useState(false);
  const [language, setLanguage] = useState<"no" | "en">("no");
  const [translatedItems, setTranslatedItems] = useState<DigestItem[]>([]);
  const resizeRef = useRef<HTMLDivElement>(null);
  
  const t = translations[language];
  
  // Translate case content when language changes
  // TRANSLATION TEMPORARILY DISABLED
  useEffect(() => {
    if (digest && digest.items.length > 0) {
      // Always use original items (translation disabled)
      setTranslatedItems(digest.items);
      
      /* Translation disabled - uncomment to re-enable
      if (language === "en") {
        // Call translation API
        fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: digest.items,
            language: "en",
          }),
        })
          .then(res => res.json())
          .then(data => setTranslatedItems(data.items || []))
          .catch(error => {
            console.error("Translation error:", error);
            // Fallback to original items if translation fails
            setTranslatedItems(digest.items);
          });
      } else {
        // Use original items for Norwegian
        setTranslatedItems(digest.items);
      }
      */
    }
  }, [digest, language]);
  
  // Use translated items if available, otherwise use original
  const displayItems = translatedItems.length > 0 ? translatedItems : (digest?.items || []);

  const fetchDigest = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const refreshParam = forceRefresh ? '?refresh=true' : '';
      const response = await fetch(`/api/digest${refreshParam}`, {
        cache: forceRefresh ? 'no-store' : 'default',
      });
      if (!response.ok) {
        throw new Error("Failed to fetch digest");
      }
      const data: DigestResponse = await response.json();
      setDigest(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDigest();
  }, []);

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      e.preventDefault(); // Prevent text selection
      const container = resizeRef.current?.parentElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Constrain left side between 30% and 70%, so chat is between 30% and 70%
      const leftSideWidth = Math.max(30, Math.min(70, newWidth));
      const chatSideWidth = 100 - leftSideWidth;
      
      // Ensure chat is at least 30% and left side is at least 30%
      const finalChatWidth = Math.max(30, Math.min(70, chatSideWidth));
      setChatWidth(finalChatWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault(); // Prevent text selection on mousedown
    };

    const preventSelect = (e: Event) => e.preventDefault();

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('selectstart', preventSelect); // Prevent text selection
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.style.pointerEvents = 'auto';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectstart', preventSelect);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    };
  }, [isResizing]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("no-NO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatUpdateDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("no-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{t.error} {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t.tryAgain}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3]">
      {/* Split screen layout when chat is open */}
      <div className={`flex h-screen ${chatOpen ? "overflow-hidden" : ""}`}>
        {/* Left side - Cases */}
        <div 
          className={`${chatOpen ? "border-r border-gray-200 overflow-y-auto" : "w-full"} transition-all duration-300`}
          style={chatOpen ? { width: `${100 - chatWidth}%`, minWidth: '30%', maxWidth: '70%' } : {}}
        >
          <div className="max-w-4xl mx-auto py-8 px-4">
                <header className="mb-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-4xl font-serif text-[#1a1a1a] mb-1 italic">
                        tinget.ai
                      </h1>
                      {digest && (
                        <p className="text-sm text-[#666]">
                          {formatDate(digest.date)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => fetchDigest(true)}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-[#0066cc] bg-white border border-[#0066cc] rounded-lg hover:bg-[#f0f7ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      title="Oppdater innhold"
                    >
                      <svg
                        className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      {loading ? t.refreshing : t.refresh}
                    </button>
                  </div>
                </header>

        {digest && digest.items.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">
              {t.noDocuments}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayItems.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 transition-all relative mb-4"
              >
                <h2 className="text-base font-normal text-[#1a1a1a] mb-3 leading-snug">
                  {item.title}
                </h2>
                
                {/* Source tags and tema */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {/* Tema tag */}
                  {item.tema && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700 border border-slate-300">
                      {item.tema}
                    </span>
                  )}
                  
                  {/* Source tags */}
                  {item.source && (
                    <>
                      {item.source.type === "regjering" && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-800 border border-gray-300">
                          {item.source.department || "Regjeringen"}
                        </span>
                      )}
                    {item.source.type === "representant" && item.source.representatives && item.source.representatives.length > 0 && (
                      <>
                        {item.source.representatives.map((rep, repIndex) => {
                          if (!rep || !rep.name) return null;
                          const colors = getPartyColors(rep.partyId || "");
                          
                          // Build class string with explicit classes
                          const classParts = [
                            "px-3",
                            "py-1", 
                            "rounded-full",
                            "text-sm",
                            "font-medium",
                            "border",
                            colors.bg || "bg-gray-500",
                            colors.text || "text-white",
                            colors.border || colors.bg || "border-gray-600",
                          ];
                          
                          const fullClasses = classParts.join(" ");
                          
                          return (
                            <span key={repIndex} className="inline-flex items-center gap-1">
                              {rep.url ? (
                                <a
                                  href={rep.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${fullClasses} hover:opacity-90 transition-opacity`}
                                >
                                  {rep.name} {rep.party && `(${rep.party})`}
                                </a>
                              ) : (
                                <span className={fullClasses}>
                                  {rep.name} {rep.party && `(${rep.party})`}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </>
                      )}
                    </>
                  )}
                </div>

                <p className="text-[#4a4a4a] mb-4 leading-relaxed text-[15px]">
                  {item.summary}
                </p>
                <div className="bg-[#f5f5f5] rounded-md p-4 mb-4 border-l-4 border-[#0066cc]">
                  <h3 className="font-medium text-[#1a1a1a] mb-2 text-sm">
                    {t.whyImportant}
                  </h3>
                  <div className="text-[#4a4a4a] whitespace-pre-line leading-relaxed text-[15px]">
                    {item.whyItMatters}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-[#0066cc] hover:text-[#0052a3] font-medium whitespace-nowrap"
                      >
                        {t.readFull}
                      </a>
                    )}
                    <button
                      onClick={() => {
                        if (!casesInChat.find((c) => c.url === item.url)) {
                          setCasesInChat([...casesInChat, item]);
                          setChatOpen(true);
                        }
                      }}
                      disabled={casesInChat.some((c) => c.url === item.url)}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                    >
                      {casesInChat.some((c) => c.url === item.url) ? t.inChat : t.addToChat}
                    </button>
                  </div>
                  {item.date && (
                    <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                      {t.updated} {formatUpdateDate(item.date)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
          </div>
        </div>

        {/* Resizer */}
        {chatOpen && (
          <div
            ref={resizeRef}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            className="bg-gray-200 hover:bg-[#0066cc] cursor-col-resize transition-colors z-10 select-none"
            style={{ width: '4px', minWidth: '4px', userSelect: 'none' }}
          />
        )}

        {/* Right side - Chat (when open) */}
        {chatOpen && (
          <div 
            className="border-l border-gray-200 bg-white flex flex-col"
            style={{ width: `${chatWidth}%` }}
          >
            <ChatWindow
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
              cases={casesInChat}
              onRemoveCase={(index) => {
                setCasesInChat(casesInChat.filter((_, i) => i !== index));
              }}
              language={language}
            />
          </div>
        )}
      </div>

      {/* Floating Chat Button (only when chat is closed) */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 bg-[#0066cc] text-white px-5 py-2.5 rounded-lg shadow-lg hover:bg-[#0052a3] transition-colors flex items-center gap-2 z-40 font-medium text-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {t.chat} {casesInChat.length > 0 && `(${casesInChat.length})`}
        </button>
      )}
    </div>
  );
}

