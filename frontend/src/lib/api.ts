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

// ── API ───────────────────────────────────────────────────────────────────────
export const api = {

  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    register: (email: string, username: string, password: string) =>
      req<{ message: string }>("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      }),

    // ✅ UPDATED LOGIN (identifier support + full user data)
    login: (identifier: string, password: string) => {
      const body = new URLSearchParams({ username: identifier, password });

      return req<{
        access_token: string;
        token_type: string;
        username: string;
        email: string;
        display_name: string;
        avatar_color: string;
      }>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    },

    // ✅ NEW: Forgot Password
    forgotPassword: (email: string) =>
      req<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),

    // ✅ NEW: Reset Password
    resetPassword: (token: string, new_password: string) =>
      req<{ message: string }>("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password }),
      }),

    // ✅ NEW: Update Profile
    updateProfile: (data: {
      display_name?: string;
      username?: string;
      avatar_color?: string;
    }) =>
      req<{ message: string }>("/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify(data),
      }),

    // ✅ NEW: Change Password
    changePassword: (current_password: string, new_password: string) =>
      req<{ message: string }>("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({ current_password, new_password }),
      }),

    // ✅ NEW: Verify Token (session restore)
    verifyToken: () =>
      req<{
        valid: boolean;
        username: string;
        email: string;
        display_name: string;
        avatar_color: string;
      }>("/auth/verify-token", {
        headers: authH(),
      }),
  },

  // ── Documents ───────────────────────────────────────────────────────────────
  docs: {
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);

      return req<{
        doc_id: string;
        filename: string;
        pages_loaded: number;
        chunks_stored: number;
      }>("/documents/upload", {
        method: "POST",
        headers: authH(),
        body: fd,
      });
    },

    uploadBatch: (files: File[]) => {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));

      return req<{
        uploaded: number;
        failed: number;
        results: Array<{
          doc_id: string;
          filename: string;
          pages_loaded: number;
          chunks_stored: number;
        }>;
        errors: Array<{ filename: string; error: string }>;
      }>("/documents/upload/batch", {
        method: "POST",
        headers: authH(),
        body: fd,
      });
    },

    list: () =>
      req<{
        total: number;
        documents: Array<{
          doc_id: string;
          filename: string;
          pages: number;
          chunks: number;
          uploaded_at: string;
        }>;
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
        documents: Array<{
          doc_id: string;
          filename: string;
          pages: number;
          chunks: number;
          uploaded_at: string;
        }>;
      }>("/history/documents"),
  },

  // ── Streaming ───────────────────────────────────────────────────────────────
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
        // Try to extract error detail from response body
        let errMsg = `Stream request failed: HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.detail) errMsg = errData.detail;
        } catch { /* ignore */ }
        cb.onError(errMsg);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += dec.decode(value, { stream: true });

          // SSE events are separated by double newlines
          // Split carefully — a single data: line may itself contain \\n (escaped)
          const events = buf.split("\n\n");
          // Keep the last incomplete chunk in the buffer
          buf = events.pop() ?? "";

          for (const event of events) {
            // An SSE event may have multiple lines; find the data: line
            const dataLine = event
              .split("\n")
              .find(l => l.startsWith("data: "));

            if (!dataLine) continue;

            const jsonStr = dataLine.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const evt = JSON.parse(jsonStr) as {
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
            } catch (parseErr) {
              // Don't surface JSON parse errors as chat messages —
              // just log them and continue processing the stream
              console.warn("SSE parse error (skipping):", parseErr, "raw:", jsonStr.slice(0, 120));
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      cb.onError(err instanceof Error ? err.message : "Stream failed");
    }
  })();

  return () => controller.abort();
},
};