const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function authH(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("finsight_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, opts);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
  if (!res.ok) {
    const detail = (data as { detail?: string })?.detail;
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (email: string, username: string, password: string) =>
      req<{ message: string }>("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      }),

    login: (email: string, password: string) => {
      const body = new URLSearchParams({ username: email, password });
      return req<{ access_token: string; username: string; token_type: string }>(
        "/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        }
      );
    },
  },

  // ── Documents ───────────────────────────────────────────────────────────────
  docs: {
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return req<{ doc_id: string; filename: string; pages_loaded: number; chunks_stored: number }>(
        "/documents/upload",
        { method: "POST", headers: authH(), body: fd }
      );
    },

    uploadBatch: (files: File[]) => {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      return req<{
        uploaded: number;
        failed: number;
        results: Array<{ doc_id: string; filename: string; pages_loaded: number; chunks_stored: number }>;
        errors: Array<{ filename: string; error: string }>;
      }>("/documents/upload/batch", { method: "POST", headers: authH(), body: fd });
    },

    list: () =>
      req<{
        total: number;
        documents: Array<{ doc_id: string; filename: string; pages: number; chunks: number; uploaded_at: string }>;
      }>("/documents/list"),

    delete: (doc_id: string) =>
      req<{ message: string; doc_id: string }>(
        `/documents/delete/${doc_id}`,
        { method: "DELETE", headers: authH() }
      ),

    status: () => req<Record<string, unknown>>("/documents/status"),
  },

  // ── Queries ─────────────────────────────────────────────────────────────────
  query: {
    simple: (question: string, doc_id?: string | string[]) =>
      req<{ answer: string; sources?: unknown[] }>("/documents/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({ question, doc_id: doc_id ?? null }),
      }),

    agent: (query: string, doc_id?: string | string[]) =>
      req<{
        answer: string;
        tools_used: string[];
        reasoning: string;
        llm_calls: number;
        sub_queries: string[];
        sources: unknown[];
      }>("/documents/agent/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({ query, doc_id: doc_id ?? null }),
      }),
  },

  // ── History ─────────────────────────────────────────────────────────────────
  history: {
    list: (limit = 50) =>
      req<{
        total: number;
        queries: Array<{
          id: number;
          query: string;
          answer: string;
          answer_preview: string;
          tools_used: string;
          reasoning: string;
          llm_calls: number;
          created_at: string;
        }>;
      }>(`/history/queries?limit=${limit}`),

    get: (id: number) =>
      req<{
        id: number;
        query: string;
        answer: string;
        tools_used: string;
        reasoning: string;
        llm_calls: number;
        created_at: string;
      }>(`/history/queries/${id}`),

    delete: (id: number) =>
      req<{ message: string; id: number }>(
        `/history/queries/${id}`,
        { method: "DELETE", headers: authH() }
      ),

    documents: () =>
      req<{
        total: number;
        documents: Array<{ doc_id: string; filename: string; pages: number; chunks: number; uploaded_at: string }>;
      }>("/history/documents"),
  },

  // ── Streaming ────────────────────────────────────────────────────────────────
  stream: (
    query: string,
    doc_id: string | string[] | undefined,
    cb: {
      onStatus: (msg: string) => void;
      onToken: (t: string) => void;
      onDone: (meta: Record<string, unknown>) => void;
      onError: (e: string) => void;
    }
  ): (() => void) => {
    // AbortController gives us a real cancellation path
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${BASE}/documents/agent/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authH() },
          body: JSON.stringify({ query, doc_id: doc_id ?? null }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Stream request failed: HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const evt = JSON.parse(line.slice(6)) as {
                  type: string;
                  content?: string;
                  message?: string;
                  metadata?: Record<string, unknown>;
                };
                if (evt.type === "token" && evt.content !== undefined) {
                  cb.onToken(evt.content);
                } else if (evt.type === "status" && evt.message) {
                  cb.onStatus(evt.message);
                } else if (evt.type === "done") {
                  cb.onDone(evt.metadata ?? {});
                } else if (evt.type === "error" && evt.message) {
                  cb.onError(evt.message);
                }
              } catch {
                // malformed SSE line — skip
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err: unknown) {
        // AbortError is expected on cancel — don't surface it
        if (err instanceof Error && err.name === "AbortError") return;
        cb.onError(err instanceof Error ? err.message : "Stream failed");
      }
    })();

    // Return cancel function
    return () => controller.abort();
  },
};