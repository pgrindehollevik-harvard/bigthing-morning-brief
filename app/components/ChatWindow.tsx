"use client";

import { useState, useRef, useEffect } from "react";
import { DigestItem } from "@/types";
import MessageContent from "./MessageContent";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  cases: DigestItem[];
  onRemoveCase: (index: number) => void;
}

// Generate intelligent, context-aware suggested questions
function generateSuggestedQuestions(cases: DigestItem[]): string[] {
  if (cases.length === 0) {
    return [
      "Hva er de viktigste sakene i dag?",
      "Finn nyheter om statsbudsjettet",
      "Hva er sammenhengen mellom sakene?",
    ];
  }

  const questions: string[] = [];
  
  if (cases.length === 1) {
    const caseItem = cases[0];
    const title = caseItem.title;
    
    // Extract key terms from title (remove common prefixes)
    const cleanTitle = title
      .replace(/^(Representantforslag|Proposisjon|Melding|Innstilling)\s+(om|fra|til)\s+/i, "")
      .substring(0, 50);
    
    // Get context from the case
    const tema = caseItem.tema || "";
    const sourceType = caseItem.source?.type;
    const department = caseItem.source?.department;
    const representatives = caseItem.source?.representatives || [];
    
    // Generate context-aware questions
    if (sourceType === "regjering" && department) {
      questions.push(
        `Hva er ${department}s forslag i ${cleanTitle}?`,
        `Hva er regjeringens begrunnelse for ${cleanTitle}?`,
        `Hvilke konsekvenser vil ${cleanTitle} ha for norske borgere?`
      );
    } else if (representatives.length > 0) {
      const partyNames = [...new Set(representatives.map(r => r.party))].join(" og ");
      questions.push(
        `Hvorfor har ${partyNames} fremmet ${cleanTitle}?`,
        `Hva er de politiske implikasjonene av ${cleanTitle}?`,
        `Hvilke interesser representerer ${cleanTitle}?`
      );
    }
    
    // Add tema-specific questions
    if (tema) {
      questions.push(
        `Hva betyr ${cleanTitle} for ${tema}?`,
        `Hvordan påvirker ${cleanTitle} norsk ${tema}?`
      );
    }
    
    // Add general policy-focused questions
    questions.push(
      `Hva er hovedpunktene i ${cleanTitle}?`,
      `Hva er status og neste steg for ${cleanTitle}?`,
      `Finn norske nyheter om ${cleanTitle}`
    );
    
    // Remove duplicates and limit length
    const uniqueQuestions = Array.from(new Set(questions))
      .filter(q => q.length < 100)
      .slice(0, 4);
    
    return uniqueQuestions;
  } else {
    // Multiple cases - focus on connections and patterns
    const temas = [...new Set(cases.map(c => c.tema).filter(Boolean))];
    const parties = new Set<string>();
    cases.forEach(c => {
      c.source?.representatives?.forEach(r => parties.add(r.party));
    });
    const partyList = Array.from(parties).slice(0, 3).join(", ");
    
    questions.push(
      "Hva er sammenhengen mellom disse sakene?",
      "Hvilke politiske mønstre ser vi i disse sakene?",
      "Hva er de viktigste implikasjonene av disse sakene sammen?"
    );
    
    if (partyList) {
      questions.push(`Hvilke partier driver disse sakene frem?`);
    }
    
    if (temas.length > 0) {
      questions.push(`Hva er felles temaer i disse sakene?`);
    }
    
    questions.push("Finn norske nyheter om disse sakene");
    
    return questions.slice(0, 4);
  }
}

export default function ChatWindow({
  isOpen,
  onClose,
  cases,
  onRemoveCase,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    if (!messageText) setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          cases: cases,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: "Beklager, det oppstod en feil. Prøv igjen.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent("");
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = generateSuggestedQuestions(cases);

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a1a]">
            Analyse og diskusjon
          </h2>
          <p className="text-xs text-[#666] mt-0.5">
            {cases.length} {cases.length === 1 ? "sak" : "saker"} i kontekst
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-[#666] hover:text-[#1a1a1a] text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
        >
          ×
        </button>
      </div>

      {/* Cases in context */}
      {cases.length > 0 && (
        <div className="p-3 border-b border-gray-200 bg-[#fafafa] max-h-40 overflow-y-auto">
          <p className="text-xs font-medium text-[#666] mb-2">
            Saker i kontekst:
          </p>
          <div className="space-y-2">
            {cases.map((caseItem, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-2 px-3 py-2 bg-white rounded text-sm text-[#4a4a4a] border border-gray-200"
              >
                <span className="flex-1">{caseItem.title}</span>
                <button
                  onClick={() => onRemoveCase(index)}
                  className="text-[#999] hover:text-[#cc0000] ml-2 flex-shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-[#666] mt-12">
            <p className="mb-3 text-[#1a1a1a] font-medium">
              {cases.length > 0
                ? "Start en samtale om sakene"
                : "Start en samtale"}
            </p>
            <p className="text-sm mb-6">
              {cases.length > 0
                ? "Du kan spørre om sammenhenger, implikasjoner, eller be om analyse."
                : "Legg til saker fra kortene over, eller still generelle spørsmål om norsk politikk."}
            </p>
            
            {/* Suggested questions */}
            {suggestedQuestions.length > 0 && (
              <div className="space-y-2 max-w-md mx-auto">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSend(question)}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#0066cc] bg-[#f0f7ff] hover:bg-[#e0efff] rounded-lg border border-[#cce5ff] transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg ${
                msg.role === "user"
                  ? "bg-[#0066cc] text-white px-4 py-3"
                  : "bg-[#f8f8f8] text-[#1a1a1a] px-4 py-3.5 border border-gray-200/50"
              }`}
            >
              <MessageContent content={msg.content} isUser={msg.role === "user"} />
            </div>
          </div>
        ))}
        
        {/* Streaming/Thinking indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#f5f5f5] rounded-lg p-3.5 max-w-[85%]">
              <div className="flex items-center gap-2 text-[#666] text-sm">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-[#999] rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-[#999] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-1.5 h-1.5 bg-[#999] rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
                <span className="text-xs">Tenker...</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Show suggested questions after first message */}
        {messages.length > 0 && !isLoading && suggestedQuestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[#666] mb-2">Forslag:</p>
            {suggestedQuestions.slice(0, 2).map((question, index) => (
              <button
                key={index}
                onClick={() => handleSend(question)}
                className="w-full text-left px-3 py-2 text-sm text-[#0066cc] bg-[#f0f7ff] hover:bg-[#e0efff] rounded-lg border border-[#cce5ff] transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Spør om sakene, sammenhenger, eller be om analyse..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066cc] focus:border-transparent text-[15px]"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="px-5 py-2.5 bg-[#0066cc] text-white rounded-lg hover:bg-[#0052a3] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
