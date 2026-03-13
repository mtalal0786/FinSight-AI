// No external deps — pure localStorage

type Doc = {
  doc_id: string;
  filename: string;
  pages: number;
  chunks: number;
  uploaded_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  status?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

const P = "finsight_";

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(P + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(P + key, JSON.stringify(value));
  } catch {
    // storage quota exceeded — silent
  }
}

export const store = {
  // ── Documents ──────────────────────────────────────────────────────────────

  getDocs: (): Doc[] => safeGet<Doc[]>("docs", []),

  setDocs: (docs: Doc[]) => safeSet("docs", docs),

  addDoc: (doc: Doc) => {
    const docs = store.getDocs();
    if (!docs.find(d => d.doc_id === doc.doc_id)) {
      store.setDocs([doc, ...docs]);
    }
  },

  removeDoc: (doc_id: string) => {
    store.setDocs(store.getDocs().filter(d => d.doc_id !== doc_id));
    // Clean up active selection too
    store.setActiveDocIds(store.getActiveDocIds().filter(id => id !== doc_id));
  },

  // ── Active document IDs (multi-select) ───────────────────────────────────

  getActiveDocIds: (): string[] => {
    const raw = safeGet<unknown>("active_docs", []);
    return Array.isArray(raw)
      ? raw.filter((v): v is string => typeof v === "string")
      : [];
  },

  setActiveDocIds: (ids: string[]) => {
    const unique = [...new Set(ids)];
    if (unique.length > 0) {
      safeSet("active_docs", unique);
    } else {
      localStorage.removeItem(P + "active_docs");
    }
  },

  // ── Chat messages ─────────────────────────────────────────────────────────

  getMessages: (): Message[] => safeGet<Message[]>("messages", []),

  setMessages: (msgs: Message[]) => {
    // Strip streaming state before persisting, keep last 50
    const toSave = msgs
      .filter(m => !m.streaming)
      .slice(-50)
      .map(m => ({ ...m, status: undefined }));
    safeSet("messages", toSave);
  },

  clearMessages: () => {
    localStorage.removeItem(P + "messages");
  },

  // ── Active tool ───────────────────────────────────────────────────────────

  getActiveTool: (): string => {
    return localStorage.getItem(P + "tool") || "agent";
  },

  setActiveTool: (tool: string) => {
    localStorage.setItem(P + "tool", tool);
  },
};