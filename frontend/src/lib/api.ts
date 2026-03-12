const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("finsight_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(email: string, username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Registration failed");
  return data;
}

export async function login(email: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login failed");
  return data;
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function uploadPDF(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Upload failed");
  return data;
}

export async function simpleQuery(question: string, docId?: string) {
  const res = await fetch(`${API_BASE}/documents/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ question, doc_id: docId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Query failed");
  return data;
}

export async function agentQuery(query: string, docId?: string) {
  const res = await fetch(`${API_BASE}/documents/agent/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ query, doc_id: docId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Agent query failed");
  return data;
}

export async function getStatus() {
  const res = await fetch(`${API_BASE}/documents/status`);
  return res.json();
}

export async function getHistory() {
  const res = await fetch(`${API_BASE}/history/queries`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) return { queries: [] };
  return res.json();
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export function streamAgentQuery(
  query: string,
  docId: string | undefined,
  onToken: (token: string) => void,
  onStatus: (msg: string) => void,
  onDone: (meta: Record<string, unknown>) => void,
  onError: (err: string) => void
): () => void {
  let cancelled = false;

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/documents/agent/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ query, doc_id: docId }),
      });

      if (!res.ok) throw new Error("Stream request failed");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (cancelled) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "token") onToken(event.content);
            else if (event.type === "status") onStatus(event.message);
            else if (event.type === "done") onDone(event.metadata);
            else if (event.type === "error") onError(event.message);
          } catch {}
        }
      }
    } catch (err) {
      onError(String(err));
    }
  })();

  return () => { cancelled = true; };
}