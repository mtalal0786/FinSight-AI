"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Zap } from "lucide-react";
import { getHistory } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

interface Query {
  id: number;
  query: string;
  answer_preview: string;
  tools_used: string;
  llm_calls: number;
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    getHistory().then((data) => {
      setQueries(data.queries || []);
      setLoading(false);
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold mb-6">Query History</h1>

        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : queries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No queries yet. Start asking questions!</div>
        ) : (
          <div className="space-y-4">
            {queries.map((q) => (
              <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-600 transition">
                <p className="font-medium text-white mb-2">{q.query}</p>
                <p className="text-sm text-gray-400 mb-3 leading-relaxed">{q.answer_preview}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(q.created_at).toLocaleString()}
                  </span>
                  {q.tools_used && (
                    <span className="flex items-center gap-1">
                      <Zap size={12} />
                      {q.tools_used}
                    </span>
                  )}
                  <span>{q.llm_calls} LLM calls</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}