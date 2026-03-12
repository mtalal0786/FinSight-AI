"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, Zap, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { streamAgentQuery } from "@/lib/api";
import toast from "react-hot-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  metadata?: {
    tools_used?: string[];
    llm_calls?: number;
    sub_queries?: string[];
    reasoning?: string;
  };
}

interface Props {
  docId?: string;
}

const EXAMPLE_QUERIES = [
  "What is this document about and what are the main risk factors?",
  "Analyze AAPL stock — current price and fundamentals",
  "What are the revenue trends mentioned in the uploaded report?",
  "Compare MSFT vs GOOGL current market performance",
];

export default function ChatInterface({ docId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedMeta, setExpandedMeta] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (query?: string) => {
    const text = (query || input).trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    let statusText = "";

    cancelRef.current = streamAgentQuery(
      text,
      docId,
      (token) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: m.content + token } : m)
        );
      },
      (status) => {
        statusText = status;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: statusText + "\n\n" } : m)
        );
      },
      (meta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, metadata: meta as Message["metadata"] }
              : m
          )
        );
        setLoading(false);
      },
      (err) => {
        toast.error(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "❌ Error: " + err, streaming: false } : m
          )
        );
        setLoading(false);
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="text-emerald-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">FinSight AI Agent</h2>
                <p className="text-gray-400 text-sm">Ask anything about markets, stocks, or your documents</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left p-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-xl text-sm text-gray-300 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 mt-1">
                <Bot size={16} className="text-emerald-400" />
              </div>
            )}

            <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "items-end flex flex-col" : ""}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-emerald-500/20 text-white border border-emerald-500/30"
                  : "bg-gray-800/80 text-gray-100 border border-gray-700"
              }`}>
                {msg.content}
                {msg.streaming && (
                  <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 animate-pulse rounded-sm" />
                )}
              </div>

              {/* Metadata accordion */}
              {msg.metadata && (
                <div className="text-xs">
                  <button
                    onClick={() => setExpandedMeta(expandedMeta === msg.id ? null : msg.id)}
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition"
                  >
                    <Zap size={12} />
                    {msg.metadata.tools_used?.join(", ")} · {msg.metadata.llm_calls} LLM calls
                    {expandedMeta === msg.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {expandedMeta === msg.id && (
                    <div className="mt-2 p-3 bg-gray-900 border border-gray-700 rounded-xl space-y-2">
                      {msg.metadata.reasoning && (
                        <p className="text-gray-400"><span className="text-gray-300 font-medium">Reasoning:</span> {msg.metadata.reasoning}</p>
                      )}
                      {msg.metadata.sub_queries && msg.metadata.sub_queries.length > 0 && (
                        <div>
                          <p className="text-gray-300 font-medium mb-1">Sub-queries:</p>
                          {msg.metadata.sub_queries.map((q, i) => (
                            <p key={i} className="text-gray-400">• {q}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                <User size={16} className="text-gray-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
            placeholder="Ask about your documents, stocks, or market trends..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition text-sm"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}