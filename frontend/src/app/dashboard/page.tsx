"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, LogOut, History, Upload, MessageSquare } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import ChatInterface from "@/components/ChatInterface";
import { isLoggedIn, getUsername, clearToken } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [docId, setDocId] = useState<string | undefined>();
  const [docName, setDocName] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<"chat" | "upload">("chat");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    setUsername(getUsername() || "User");
  }, [router]);

  const handleLogout = () => {
    clearToken();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-emerald-400" size={22} />
          <span className="font-bold text-lg">FinSight AI</span>
        </div>
        <div className="flex items-center gap-4">
          {docName && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full truncate max-w-[200px]">
              📄 {docName}
            </span>
          )}
          <span className="text-gray-400 text-sm hidden sm:block">👋 {username}</span>
          <button
            onClick={() => router.push("/dashboard/history")}
            className="p-2 text-gray-400 hover:text-white transition"
            title="Query History"
          >
            <History size={18} />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white text-sm transition"
          >
            <LogOut size={16} />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="flex border-b border-gray-800 sm:hidden">
        {[
          { key: "chat", icon: <MessageSquare size={16} />, label: "Chat" },
          { key: "upload", icon: <Upload size={16} />, label: "Upload" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "chat" | "upload")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition ${
              activeTab === tab.key
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400"
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — upload (desktop always visible) */}
        <aside className={`w-80 border-r border-gray-800 p-4 flex-col gap-4 shrink-0 overflow-y-auto ${
          activeTab === "upload" ? "flex" : "hidden sm:flex"
        }`}>
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Upload Document
            </h2>
            <FileUpload onUpload={(id, name) => { setDocId(id); setDocName(name); setActiveTab("chat"); }} />
          </div>

          <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">💡 Tips</h3>
            <ul className="text-xs text-gray-400 space-y-1.5">
              <li>• Upload annual reports, 10-Ks, or earnings PDFs</li>
              <li>• Mention stock tickers like AAPL, TSLA for live data</li>
              <li>• Ask multi-part questions for deeper analysis</li>
              <li>• The agent picks the right tools automatically</li>
            </ul>
          </div>
        </aside>

        {/* Chat area */}
        <main className={`flex-1 overflow-hidden ${activeTab === "chat" ? "flex" : "hidden sm:flex"} flex-col`}>
          <ChatInterface docId={docId} />
        </main>
      </div>
    </div>
  );
}