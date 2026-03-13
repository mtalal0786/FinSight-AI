"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, LogOut, Bot, FileSearch,
  History, Database, Menu, X, ChevronRight, Files,
} from "lucide-react";
import MultiFileUpload from "@/components/MultiFileUpload";
import ChatInterface from "@/components/ChatInterface";
import DocumentManager from "@/components/DocumentManager";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { api } from "@/lib/api";
import Markdown from "@/components/Markdown";

type ActiveDoc = { doc_id: string; filename: string };

type HistoryItem = {
  id: number;
  query: string;
  answer_preview: string;
  tools_used: string;
  llm_calls: number;
  created_at: string;
};

type HistoryDetail = {
  id: number;
  query: string;
  answer: string;
  tools_used: string;
  reasoning: string;
  llm_calls: number;
  created_at: string;
};

const TOOLS = [
  { id: "agent", label: "Agent Chat", icon: Bot, desc: "Multi-tool AI research" },
  { id: "simple", label: "RAG Chat", icon: FileSearch, desc: "Document Q&A only" },
  { id: "docs", label: "Documents", icon: Database, desc: "Manage uploaded files" },
  { id: "history", label: "History", icon: History, desc: "Past queries" },
] as const;

type ToolId = typeof TOOLS[number]["id"];

export default function DashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [activeDocs, setActiveDocs] = useState<ActiveDoc[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId>("agent");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryDetail | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.isLoggedIn()) {
      router.push("/login");
      return;
    }
    setUsername(auth.username());

    // Restore persisted state
    const savedDocs = store.getDocs();
    const savedIds = store.getActiveDocIds();
    const active: ActiveDoc[] = savedIds
      .map(id => savedDocs.find(d => d.doc_id === id))
      .filter(Boolean)
      .map(d => ({
        doc_id: d!.doc_id,
        filename: d!.filename,
      }));
    if (active.length) setActiveDocs(active);

    const savedTool = store.getActiveTool() as ToolId;
    setActiveTool(savedTool);
  }, [router]);

  // ── History loader ─────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.history.list(50);
      setHistoryItems(data.queries);
    } catch {
      // silent — user may not be authed or history is empty
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTool === "history") loadHistory();
  }, [activeTool, loadHistory]);

  // ── Tool switch ────────────────────────────────────────────────────────────
  const handleToolChange = useCallback((id: ToolId) => {
    setActiveTool(id);
    store.setActiveTool(id);
    setSelectedHistory(null);
  }, []);

  // ── Document selection ─────────────────────────────────────────────────────
  const updateActiveDocs = useCallback((docs: ActiveDoc[]) => {
    setActiveDocs(docs);
    store.setActiveDocIds(docs.map(d => d.doc_id));
  }, []);

  /** Toggle a single doc on/off (DocumentManager clicks) */
  const handleDocToggle = useCallback((doc: { doc_id: string; filename: string }) => {
    setActiveDocs(prev => {
      const exists = prev.some(d => d.doc_id === doc.doc_id);
      const next = exists
        ? prev.filter(d => d.doc_id !== doc.doc_id)
        : [{ doc_id: doc.doc_id, filename: doc.filename }, ...prev];
      store.setActiveDocIds(next.map(d => d.doc_id));
      return next;
    });
    // Switch to agent chat when a doc is selected
    setActiveTool(prev => (prev === "docs" || prev === "history" ? "agent" : prev));
    store.setActiveTool("agent");
  }, []);

  /** Add newly uploaded docs and activate them (MultiFileUpload callback) */
  const handleDocAdd = useCallback((docs: Array<{ doc_id: string; filename: string }>) => {
    setActiveDocs(prev => {
      const existingIds = new Set(prev.map(d => d.doc_id));
      const fresh = docs.filter(d => !existingIds.has(d.doc_id));
      const next = [...fresh, ...prev];
      store.setActiveDocIds(next.map(d => d.doc_id));
      return next;
    });
    setActiveTool("agent");
    store.setActiveTool("agent");
  }, []);

  // ── History actions ────────────────────────────────────────────────────────
  const handleHistoryClick = useCallback(async (id: number) => {
    setHistoryDetailLoading(true);
    setSelectedHistory(null);
    try {
      const full = await api.history.get(id);
      setSelectedHistory(full);
    } catch {
      setSelectedHistory(null);
    } finally {
      setHistoryDetailLoading(false);
    }
  }, []);

  const handleDeleteHistory = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.history.delete(id);
      setHistoryItems(prev => prev.filter(h => h.id !== id));
      if (selectedHistory?.id === id) setSelectedHistory(null);
    } catch {
      // silent
    }
  }, [selectedHistory]);

  // ── Derived display ────────────────────────────────────────────────────────
  const docLabel = (() => {
    if (activeDocs.length === 0) return null;
    if (activeDocs.length <= 2) return activeDocs.map(d => d.filename).join(", ");
    return `${activeDocs.slice(0, 2).map(d => d.filename).join(", ")} +${activeDocs.length - 2} more`;
  })();

  const activeDocIds = activeDocs.map(d => d.doc_id);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800/70 px-4 py-3 flex items-center gap-3 shrink-0 h-14">
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-800"
        >
          {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
        </button>

        <div className="flex items-center gap-1.5">
          <TrendingUp className="text-emerald-400" size={18} />
          <span className="font-bold text-sm">FinSight AI</span>
        </div>

        {docLabel && (
          <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full max-w-[220px]">
            <Files size={11} className="shrink-0" />
            <span className="truncate">{docLabel}</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-gray-500 text-xs hidden sm:block">{username}</span>
          <button
            onClick={() => { auth.clear(); router.push("/"); }}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs transition p-1.5 rounded-lg hover:bg-gray-800"
            title="Sign out"
          >
            <LogOut size={14} />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        {sidebarOpen && (
          <aside className="w-68 border-r border-gray-800/70 flex flex-col overflow-hidden bg-gray-950 shrink-0">
            {/* Tool nav */}
            <nav className="p-2 border-b border-gray-800/50 space-y-0.5">
              {TOOLS.map(tool => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolChange(tool.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${isActive
                        ? "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20"
                        : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                      }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="font-medium text-sm leading-none">{tool.label}</p>
                      <p className="text-xs opacity-50 mt-0.5 truncate">{tool.desc}</p>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Upload + doc list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Upload PDFs
                </p>
                <MultiFileUpload onUpload={handleDocAdd} />
              </div>

              <DocumentManager
                onSelect={handleDocToggle}
                activeDocIds={activeDocIds}
              />
            </div>
          </aside>
        )}

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">

          {/* Agent / Simple chat */}
          {(activeTool === "agent" || activeTool === "simple") && (
            <ChatInterface
              docIds={activeDocIds}
              toolMode={activeTool}
            />
          )}

          {/* Document manager full page */}
          {activeTool === "docs" && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-lg font-semibold mb-5">Document Manager</h2>
                <div className="mb-6">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Upload PDFs
                  </p>
                  <MultiFileUpload onUpload={handleDocAdd} />
                </div>
                <DocumentManager
                  onSelect={handleDocToggle}
                  activeDocIds={activeDocIds}
                />
              </div>
            </div>
          )}

          {/* History */}
          {activeTool === "history" && (
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* List panel */}
              <div className="w-72 border-r border-gray-800/70 flex flex-col overflow-hidden shrink-0">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800/50">
                  <h3 className="text-sm font-medium text-gray-300">Query History</h3>
                  <button
                    onClick={loadHistory}
                    className="text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    Refresh
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {historyLoading && (
                    <p className="text-xs text-gray-500 text-center py-6">Loading...</p>
                  )}
                  {!historyLoading && historyItems.length === 0 && (
                    <div className="text-center py-8 px-4">
                      <History className="text-gray-700 mx-auto mb-2" size={28} />
                      <p className="text-xs text-gray-500">No history yet.</p>
                      <p className="text-xs text-gray-600 mt-1">Ask a question to get started.</p>
                    </div>
                  )}
                  {historyItems.map(h => (
                    <div
                      key={h.id}
                      onClick={() => handleHistoryClick(h.id)}
                      className={`group p-3 rounded-xl cursor-pointer transition border ${selectedHistory?.id === h.id
                          ? "bg-emerald-500/8 border-emerald-500/20"
                          : "bg-gray-900/60 border-gray-800/60 hover:border-gray-700"
                        }`}
                    >
                      <p className="text-xs font-medium text-gray-200 truncate">{h.query}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {h.answer_preview}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-600">
                          {new Date(h.created_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <button
                          onClick={e => handleDeleteHistory(h.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail panel */}
              <div className="flex-1 overflow-y-auto p-6 min-w-0">
                {historyDetailLoading && (
                  <div className="flex justify-center py-12">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span
                          key={d}
                          className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {!historyDetailLoading && selectedHistory && (
                  <div className="max-w-3xl space-y-4">
                    {/* Query */}
                    <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4">
                      <p className="text-xs font-medium text-emerald-500 mb-2 uppercase tracking-wider">
                        Query
                      </p>
                      <p className="text-white text-sm">{selectedHistory.query}</p>
                    </div>

                    {/* Metadata row */}
                    {(selectedHistory.tools_used || selectedHistory.llm_calls > 0) && (
                      <div className="flex items-center gap-3 flex-wrap">
                        {selectedHistory.tools_used && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
                            <ChevronRight size={11} />
                            {selectedHistory.tools_used}
                          </span>
                        )}
                        {selectedHistory.llm_calls > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
                            {selectedHistory.llm_calls} LLM call{selectedHistory.llm_calls > 1 ? "s" : ""}
                          </span>
                        )}
                        <span className="text-xs text-gray-600">
                          {new Date(selectedHistory.created_at).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Answer */}
                    <div className="bg-gray-900 border border-gray-800/60 rounded-xl p-5">
                      <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">
                        Answer
                      </p>
                      <div className="text-sm">
                        <Markdown content={selectedHistory.answer} />
                      </div>
                    </div>

                    {/* Reasoning */}
                    {selectedHistory.reasoning && (
                      <div className="bg-gray-900/50 border border-gray-800/40 rounded-xl p-4">
                        <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wider">
                          Agent reasoning
                        </p>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {selectedHistory.reasoning}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {!historyDetailLoading && !selectedHistory && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <History className="text-gray-700 mb-3" size={36} />
                    <p className="text-gray-500 text-sm">Select a query to view its full answer</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}