"use client";

import { useEffect, useState } from "react";
import { DigestResponse, DigestItem } from "@/types";
import { getPartyColors } from "@/lib/partyColors";
import ChatWindow from "./components/ChatWindow";

export default function Home() {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [casesInChat, setCasesInChat] = useState<DigestItem[]>([]);

  useEffect(() => {
    async function fetchDigest() {
      try {
        setLoading(true);
        const response = await fetch("/api/digest");
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
    }

    fetchDigest();
  }, []);

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
    const dateStr = date.toLocaleDateString("no-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString("no-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} ${timeStr}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laster dagens oppsummering...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Feil: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Stortinget Morning Brief
          </h1>
          {digest && (
            <p className="text-lg text-gray-600">
              {formatDate(digest.date)}
            </p>
          )}
        </header>

        {digest && digest.items.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">
              Ingen nye dokumenter de siste 7 dagene.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {digest?.items.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow relative"
              >
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">
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

                <p className="text-gray-700 mb-4 leading-relaxed">
                  {item.summary}
                </p>
                <div className="bg-blue-50 rounded-md p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    Hvorfor dette er viktig:
                  </h3>
                  <div className="text-blue-800 whitespace-pre-line leading-relaxed">
                    {item.whyItMatters}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Les hele dokumentet →
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
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {casesInChat.some((c) => c.url === item.url) ? "✓ I chat" : "+ Legg til i chat"}
                    </button>
                  </div>
                  {item.date && (
                    <span className="text-xs text-gray-500 ml-auto">
                      Oppdatert: {formatUpdateDate(item.date)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Chat Button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2 z-40"
      >
        <svg
          className="w-5 h-5"
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
        Chat {casesInChat.length > 0 && `(${casesInChat.length})`}
      </button>

      {/* Chat Window */}
      <ChatWindow
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        cases={casesInChat}
        onRemoveCase={(index) => {
          setCasesInChat(casesInChat.filter((_, i) => i !== index));
        }}
      />
    </div>
  );
}

