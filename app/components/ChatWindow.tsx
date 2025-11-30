"use client";

import { useState, useRef, useEffect } from "react";
import { DigestItem } from "@/types";

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

export default function ChatWindow({
  isOpen,
  onClose,
  cases,
  onRemoveCase,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
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
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: "Beklager, det oppstod en feil. Prøv igjen.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Analyse og diskusjon
            </h2>
            <p className="text-sm text-gray-500">
              {cases.length} {cases.length === 1 ? "sak" : "saker"} i kontekst
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Cases in context */}
        {cases.length > 0 && (
          <div className="p-4 border-b bg-gray-50 max-h-32 overflow-y-auto">
            <p className="text-xs font-medium text-gray-700 mb-2">
              Saker i kontekst:
            </p>
            <div className="flex flex-wrap gap-2">
              {cases.map((caseItem, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-gray-700 border"
                >
                  {caseItem.title.substring(0, 40)}
                  {caseItem.title.length > 40 && "..."}
                  <button
                    onClick={() => onRemoveCase(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p className="mb-2">
                {cases.length > 0
                  ? "Start en samtale om sakene"
                  : "Start en samtale"}
              </p>
              <p className="text-sm">
                {cases.length > 0
                  ? "Du kan spørre om sammenhenger, implikasjoner, eller be om analyse."
                  : "Legg til saker fra kortene over, eller still generelle spørsmål om norsk politikk."}
              </p>
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
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Spør om sakene, sammenhenger, eller be om analyse..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

