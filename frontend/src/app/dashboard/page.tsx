"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, LogOut, Bot, FileSearch, History,
  Database, Menu, Plus, Settings, Files, MessageSquare, Trash2,
} from "lucide-react";
import MultiFileUpload from "@/components/MultiFileUpload";
import ChatInterface from "@/components/ChatInterface";
import DocumentManager from "@/components/DocumentManager";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { conversations, activeConv, type Conversation } from "@/lib/conversations";
import { api } from "@/lib/api";
import Markdown from "@/components/Markdown";

type ActiveDoc = { doc_id: string; filename: string };
type ToolId = "agent" | "simple" | "docs" | "history";

const TOOLS = [
  { id: "agent" as ToolId,   label: "Agent Chat",  icon: Bot },
  { id: "simple" as ToolId,  label: "RAG Chat",    icon: FileSearch },
  { id: "docs" as ToolId,    label: "Documents",   icon: Database },
  { id: "history" as ToolId, label: "History",     icon: History },
];

export default function DashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [avatarColor, setAvatarColor] = useState("#10b981");
  const [activeDocs, setActiveDocs] = useState<ActiveDoc[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId>("agent");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Conversation state
  const [convList, setConvList] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  // History
  const [historyItems, setHistoryItems] = useState<Array<{
    id: number; query: string; answer_preview: string;
    tools_used: string; created_at: string;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{
    id: number; query: string; answer: string;
    tools_used: string; reasoning: string; llm_calls: number; created_at: string;
  } | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.isLoggedIn()) { router.push("/login"); return; }

    // Verify token is still valid (handles expired tokens transparently)
    auth.verifyWithServer()
  .then(valid => {
    console.log("verifyWithServer result:", valid);
    if (!valid) {
      console.log("Token rejected by server → logging out");
      router.push("/login");
    }
  })
  .catch(err => {
    console.error("verifyWithServer failed with error:", err);
    router.push("/login");
  });

    const p = auth.getProfile();
    setUsername(p.display_name || p.username);
    setAvatarColor(p.avatar_color || "#10b981");

    // Restore docs
    const savedDocs = store.getDocs();
const savedIds = store.getActiveDocIds();

const active: ActiveDoc[] = savedIds
  .map(id => {
    const doc = savedDocs.find(d => d.doc_id === id);
    if (!doc) return null;

    return {
      doc_id: doc.doc_id,
      filename: doc.filename,
    };
  })
  .filter((d): d is ActiveDoc => d !== null);

if (active.length) setActiveDocs(active);

    // Restore tool
    setActiveTool(store.getActiveTool() as ToolId);

    // Load conversations
    setConvList(conversations.getAll());
    const savedConvId = activeConv.get();
    if (savedConvId && conversations.get(savedConvId)) {
      setActiveConvId(savedConvId);
    }
  }, [router]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.history.list(100);
      setHistoryItems(data.queries as typeof historyItems);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTool === "history") loadHistory();
  }, [activeTool, loadHistory]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleToolChange = useCallback((id: ToolId) => {
    setActiveTool(id);
    store.setActiveTool(id);
    setSelectedHistory(null);
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConvId(null);
    activeConv.set(null);
    setActiveTool("agent");
    store.setActiveTool("agent");
  }, []);

  const handleConvSelect = useCallback((id: string) => {
    const conv = conversations.get(id);
    if (!conv) return;
    setActiveConvId(id);
    activeConv.set(id);

    // Restore docs from that conversation
    if (conv.doc_ids.length > 0) {
      const savedDocs = store.getDocs();
      const convDocs = conv.doc_ids
        .map((docId, i) => ({
          doc_id: docId,
          filename: conv.doc_names[i] || savedDocs.find(d => d.doc_id === docId)?.filename || docId,
        }))
        .filter(d => d.doc_id);
      if (convDocs.length > 0) {
        setActiveDocs(convDocs);
        store.setActiveDocIds(convDocs.map(d => d.doc_id));
      }
    }

    setActiveTool("agent");
    store.setActiveTool("agent");
  }, []);

  const handleConvDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    conversations.delete(id);
    setConvList(conversations.getAll());
    if (activeConvId === id) {
      setActiveConvId(null);
      activeConv.set(null);
    }
  }, [activeConvId]);

  const handleDocToggle = useCallback((doc: { doc_id: string; filename: string }) => {
    setActiveDocs(prev => {
      const exists = prev.some(d => d.doc_id === doc.doc_id);
      const next = exists
        ? prev.filter(d => d.doc_id !== doc.doc_id)
        : [{ doc_id: doc.doc_id, filename: doc.filename }, ...prev];
      store.setActiveDocIds(next.map(d => d.doc_id));
      return next;
    });
    setActiveTool("agent");
    store.setActiveTool("agent");
  }, []);

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

  const handleHistoryClick = useCallback(async (id: number) => {
    setHistoryDetailLoading(true);
    setSelectedHistory(null);
    try {
      const full = await api.history.get(id) as typeof selectedHistory;
      setSelectedHistory(full);
    } catch { /* silent */ }
    finally { setHistoryDetailLoading(false); }
  }, []);

  const handleDeleteHistory = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.history.delete(id);
      setHistoryItems(prev => prev.filter(h => h.id !== id));
      if (selectedHistory?.id === id) setSelectedHistory(null);
    } catch { /* silent */ }
  }, [selectedHistory]);

  const handleNewConv = useCallback((id: string) => {
    setActiveConvId(id);
    activeConv.set(id);
    setConvList(conversations.getAll());
  }, []);

  const initials = username.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  const activeDocIds = activeDocs.map(d => d.doc_id);
  const activeDocNames = activeDocs.map(d => d.filename);
  const docLabel = activeDocs.length === 0 ? null
    : activeDocs.length <= 2 ? activeDocs.map(d => d.filename).join(", ")
    : `${activeDocs.slice(0, 2).map(d => d.filename).join(", ")} +${activeDocs.length - 2} more`;

  // Group conversations by date
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groupedConvs = convList.reduce((acc, conv) => {
    const d = new Date(conv.updated_at).toDateString();
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : new Date(conv.updated_at).toLocaleDateString([], { month: "short", day: "numeric" });
    if (!acc[label]) acc[label] = [];
    acc[label].push(conv);
    return acc;
  }, {} as Record<string, Conversation[]>);

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden" suppressHydrationWarning>
      {/* Header */}
      <header className="h-12 border-b border-gray-800/60 px-3 flex items-center gap-2.5 shrink-0 bg-gray-950 z-10">
        <button onClick={() => setSidebarOpen(v => !v)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition">
          <Menu size={16} />
        </button>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="text-emerald-400" size={16} />
          <span className="font-bold text-sm">FinSight AI</span>
        </div>
        {docLabel && (
          <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full max-w-xs hidden sm:flex">
            <Files size={11} className="shrink-0" />
            <span className="truncate">{docLabel}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={startNewConversation}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 px-2 py-1.5 rounded-lg transition">
            <Plus size={13} /> New chat
          </button>
          <button onClick={() => router.push("/profile")}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 px-2 py-1.5 rounded-lg transition">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: avatarColor }}>
              {initials}
            </div>
            <span className="hidden sm:block">{username}</span>
          </button>
          <button onClick={() => { auth.clear(); router.push("/"); }}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition" title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 border-r border-gray-800/60 flex flex-col bg-gray-950 shrink-0 overflow-hidden">
            {/* Tool nav */}
            <nav className="shrink-0 p-2 border-b border-gray-800/50 space-y-0.5">
              {TOOLS.map(tool => {
                const Icon = tool.icon;
                return (
                  <button key={tool.id} onClick={() => handleToolChange(tool.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition ${
                      activeTool === tool.id
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                        : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
                    }`}>
                    <Icon size={14} className="shrink-0" />
                    <span className="font-medium text-sm">{tool.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Scrollable area: conversations + upload + docs */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Conversations */}
              {convList.length > 0 && (
                <div className="p-2 border-b border-gray-800/40">
                  <div className="flex items-center justify-between px-1 py-1 mb-1">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Conversations</span>
                    <button onClick={() => { conversations.deleteAll(); setConvList([]); setActiveConvId(null); }}
                      className="text-xs text-gray-600 hover:text-red-400 transition" title="Clear all">
                      <Trash2 size={11} />
                    </button>
                  </div>
                  {Object.entries(groupedConvs).map(([label, convs]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-600 px-2 py-1">{label}</p>
                      {convs.map(conv => (
                        <div key={conv.id}
                          onClick={() => handleConvSelect(conv.id)}
                          className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition ${
                            activeConvId === conv.id
                              ? "bg-gray-800 text-white"
                              : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                          }`}>
                          <MessageSquare size={12} className="shrink-0 opacity-60" />
                          <span className="text-xs truncate flex-1">{conv.title}</span>
                          <button onClick={e => handleConvDelete(conv.id, e)}
                            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition shrink-0 p-0.5">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Upload + docs */}
              <div className="p-3 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Upload PDFs</p>
                  <MultiFileUpload onUpload={handleDocAdd} />
                </div>
                <DocumentManager onSelect={handleDocToggle} activeDocIds={activeDocIds} />
              </div>

              {/* Profile link */}
              <div className="p-2 border-t border-gray-800/40 mt-auto">
                <button onClick={() => router.push("/profile")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 transition">
                  <Settings size={14} />
                  <span>Settings & Profile</span>
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {(activeTool === "agent" || activeTool === "simple") && (
            <ChatInterface
              docIds={activeDocIds}
              docNames={activeDocNames}
              toolMode={activeTool}
              conversationId={activeConvId ?? undefined}
              onConversationCreate={handleNewConv}
            />
          )}

          {activeTool === "docs" && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto p-6">
                <h2 className="text-lg font-semibold mb-5">Document Manager</h2>
                <div className="mb-6">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Upload PDFs</p>
                  <MultiFileUpload onUpload={handleDocAdd} />
                </div>
                <DocumentManager onSelect={handleDocToggle} activeDocIds={activeDocIds} />
              </div>
            </div>
          )}

          {activeTool === "history" && (
            <div className="flex flex-1 overflow-hidden min-h-0">
              <div className="w-72 border-r border-gray-800/60 flex flex-col overflow-hidden shrink-0">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800/50 shrink-0">
                  <h3 className="text-sm font-medium text-gray-300">Query History</h3>
                  <button onClick={loadHistory} className="text-xs text-gray-500 hover:text-gray-300 transition">Refresh</button>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1.5">
                  {historyLoading && <p className="text-xs text-gray-500 text-center py-8">Loading...</p>}
                  {!historyLoading && historyItems.length === 0 && (
                    <div className="text-center py-10 px-4">
                      <History className="text-gray-700 mx-auto mb-2" size={24} />
                      <p className="text-xs text-gray-500">No history yet.</p>
                    </div>
                  )}
                  {historyItems.map(h => (
                    <div key={h.id} onClick={() => handleHistoryClick(h.id)}
                      className={`group p-2.5 rounded-xl cursor-pointer transition border ${
                        selectedHistory?.id === h.id
                          ? "bg-emerald-500/8 border-emerald-500/20"
                          : "bg-gray-900/60 border-gray-800/60 hover:border-gray-700"
                      }`}>
                      <p className="text-xs font-medium text-gray-200 truncate">{h.query}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{h.answer_preview}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-gray-700">
                          {new Date(h.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                        <button onClick={e => handleDeleteHistory(h.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 min-w-0">
                {historyDetailLoading && (
                  <div className="flex justify-center py-12">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
                {!historyDetailLoading && selectedHistory && (
                  <div className="max-w-3xl space-y-4">
                    <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4">
                      <p className="text-xs font-medium text-emerald-500 mb-2 uppercase tracking-wider">Query</p>
                      <p className="text-white text-sm">{selectedHistory.query}</p>
                    </div>
                    {selectedHistory.tools_used && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
                          {selectedHistory.tools_used}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
                          {selectedHistory.llm_calls} calls
                        </span>
                        <span className="text-xs text-gray-600">
                          {new Date(selectedHistory.created_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="bg-gray-900 border border-gray-800/60 rounded-xl p-5">
                      <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Answer</p>
                      <Markdown content={selectedHistory.answer} />
                    </div>
                    {selectedHistory.reasoning && (
                      <div className="bg-gray-900/50 border border-gray-800/40 rounded-xl p-4">
                        <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wider">Reasoning</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{selectedHistory.reasoning}</p>
                      </div>
                    )}
                  </div>
                )}
                {!historyDetailLoading && !selectedHistory && (
                  <div className="flex flex-col items-center justify-center h-full">
                    <History className="text-gray-700 mb-3" size={32} />
                    <p className="text-gray-500 text-sm">Select a query to view the full answer</p>
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