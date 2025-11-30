"use client";

import { useEffect, useState } from "react";
import { DigestResponse } from "@/types";
import { getPartyColors } from "@/lib/partyColors";

export default function Home() {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                  {item.title}
                </h2>
                
                {/* Source tags */}
                {item.source && (
                  <div className="mb-3 flex flex-wrap gap-2">
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
                  </div>
                )}

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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

