"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, Bot, User, Zap,
  ChevronDown, ChevronUp, Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { store } from "@/lib/store";
import Markdown from "./Markdown";
import toast from "react-hot-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  status?: string;
  timestamp?: string;
  metadata?: {
    tools_used?: string[];
    llm_calls?: number;
    sub_queries?: string[];
    reasoning?: string;
  };
}

const EXAMPLES = [
  "What is this document about? Summarize the key points.",
  "Analyze AAPL stock — current price and P/E ratio",
  "What are the main risk factors mentioned in the report?",
  "Compare MSFT vs GOOGL current market performance",
];

interface Props {
  docIds?: string[];
  toolMode?: "agent" | "simple";
}

export default function ChatInterface({ docIds = [], toolMode = "agent" }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedMeta, setExpandedMeta] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted messages once on mount
  useEffect(() => {
    const saved = store.getMessages();
    if (saved.length) setMessages(saved);
  }, []);

  // Persist messages whenever they settle (not mid-stream)
  useEffect(() => {
    const hasStreaming = messages.some(m => m.streaming);
    if (!hasStreaming && messages.length > 0) {
      store.setMessages(messages);
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cancel any in-flight stream on unmount
  useEffect(() => {
    return () => {
      cancelRef.current?.();
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const clearChat = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setMessages([]);
    setLoading(false);
    store.clearMessages();
    toast.success("Chat cleared");
  }, []);

  const sendMessage = useCallback(
    async (queryOverride?: string) => {
      const text = (queryOverride ?? input).trim();
      if (!text || loading) return;

      setInput("");
      setLoading(true);

      const msgId = `u-${Date.now()}`;
      const asstId = `a-${Date.now()}`;

      const userMsg: Message = {
        id: msgId,
        role: "user",
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      const asstMsg: Message = {
        id: asstId,
        role: "assistant",
        content: "",
        streaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages(prev => [...prev, userMsg, asstMsg]);

      if (toolMode === "simple") {
        try {
          const result = await api.query.simple(text, docIds.length > 0 ? docIds : undefined);
          setMessages(prev =>
            prev.map(m =>
              m.id === asstId ? { ...m, content: result.answer, streaming: false } : m
            )
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Query failed";
          toast.error(msg);
          setMessages(prev =>
            prev.map(m =>
              m.id === asstId ? { ...m, content: `❌ ${msg}`, streaming: false } : m
            )
          );
        }
        setLoading(false);
        return;
      }

      // Streaming agent
      cancelRef.current = api.stream(
        text,
        docIds.length > 0 ? docIds : undefined,
        {
          onStatus: msg =>
            setMessages(prev =>
              prev.map(m => (m.id === asstId ? { ...m, status: msg } : m))
            ),
          onToken: token =>
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId ? { ...m, content: m.content + token } : m
              )
            ),
          onDone: meta => {
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId
                  ? { ...m, streaming: false, status: undefined, metadata: meta as Message["metadata"] }
                  : m
              )
            );
            cancelRef.current = null;
            setLoading(false);
          },
          onError: err => {
            toast.error(err);
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId ? { ...m, content: `❌ ${err}`, streaming: false } : m
              )
            );
            cancelRef.current = null;
            setLoading(false);
          },
        }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, loading, toolMode, JSON.stringify(docIds)]
    // JSON.stringify(docIds) because arrays fail reference equality on every render
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Clear button */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/60 shrink-0">
          <span className="text-xs text-gray-600">
            {toolMode === "simple" ? "RAG mode" : "Agent mode"}
            {docIds.length > 0 && ` · ${docIds.length} doc${docIds.length > 1 ? "s" : ""}`}
          </span>
          <button
            onClick={clearChat}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition"
          >
            <Trash2 size={12} /> Clear
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Bot className="text-emerald-400" size={28} />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-1">
                {toolMode === "simple" ? "Document RAG" : "FinSight AI Agent"}
              </h2>
              <p className="text-gray-400 text-sm">
                {docIds.length > 0
                  ? `${docIds.length} document${docIds.length > 1 ? "s" : ""} loaded — ask anything about them`
                  : "Ask about markets, stocks, or upload a document"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {EXAMPLES.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left p-3 bg-gray-800/40 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 rounded-xl text-xs text-gray-400 hover:text-gray-200 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 mt-1">
                <Bot size={14} className="text-emerald-400" />
              </div>
            )}

            <div
              className={`max-w-[88%] space-y-1.5 min-w-0 ${
                msg.role === "user" ? "items-end flex flex-col" : ""
              }`}
            >
              {/* Streaming status pill */}
              {msg.streaming && msg.status && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full w-fit">
                  <Loader2 size={10} className="animate-spin shrink-0" />
                  <span className="truncate max-w-[240px]">{msg.status}</span>
                </div>
              )}

              {/* Bubble */}
              <div
                className={`rounded-2xl px-4 py-3 text-sm min-w-0 ${
                  msg.role === "user"
                    ? "bg-emerald-500/12 text-white border border-emerald-500/20"
                    : "bg-gray-800/60 text-gray-100 border border-gray-700/40"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    {msg.content && <Markdown content={msg.content} />}
                    {msg.streaming && !msg.content && (
                      <span className="flex gap-1 py-1">
                        {[0, 150, 300].map(d => (
                          <span
                            key={d}
                            className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${d}ms` }}
                          />
                        ))}
                      </span>
                    )}
                    {msg.streaming && msg.content && (
                      <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse rounded-sm align-middle" />
                    )}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}
              </div>

              {/* Footer row: timestamp + metadata toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                {msg.timestamp && (
                  <span className="text-xs text-gray-600">{msg.timestamp}</span>
                )}
                {msg.metadata && (
                  <button
                    onClick={() =>
                      setExpandedMeta(expandedMeta === msg.id ? null : msg.id)
                    }
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    <Zap size={10} />
                    <span>
                      {msg.metadata.tools_used?.join(", ") || "no tools"} ·{" "}
                      {msg.metadata.llm_calls ?? 0} calls
                    </span>
                    {expandedMeta === msg.id ? (
                      <ChevronUp size={10} />
                    ) : (
                      <ChevronDown size={10} />
                    )}
                  </button>
                )}
              </div>

              {/* Expanded metadata */}
              {expandedMeta === msg.id && msg.metadata && (
                <div className="p-3 bg-gray-900 border border-gray-700/50 rounded-xl text-xs space-y-2 max-w-sm">
                  {msg.metadata.reasoning && (
                    <p className="text-gray-400">
                      <span className="text-gray-300 font-medium">Reasoning: </span>
                      {msg.metadata.reasoning}
                    </p>
                  )}
                  {(msg.metadata.sub_queries?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-gray-300 font-medium mb-1">Sub-queries:</p>
                      {msg.metadata.sub_queries!.map((q, i) => (
                        <p key={i} className="text-gray-400">• {q}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-gray-700/80 flex items-center justify-center shrink-0 mt-1">
                <User size={14} className="text-gray-300" />
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-800/60 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              toolMode === "simple"
                ? "Ask about your document..."
                : "Ask about documents, stocks, or market trends... (Shift+Enter for new line)"
            }
            rows={1}
            disabled={loading}
            className="flex-1 bg-gray-800/80 border border-gray-700/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 transition text-sm resize-none leading-relaxed disabled:opacity-60"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="h-12 w-12 shrink-0 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center"
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Send size={17} />
            )}
          </button>
        </div>
        {loading && (
          <p className="text-xs text-gray-600 mt-1.5 ml-1">
            Press Esc or clear chat to cancel
          </p>
        )}
      </div>
    </div>
  );
}