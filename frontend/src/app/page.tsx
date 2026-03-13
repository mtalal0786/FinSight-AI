"use client";
import Link from "next/link";
import { TrendingUp, Bot, FileSearch, BarChart2, Shield, ArrowRight, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "Multi-tool AI Agent",
    desc: "Autonomous agent that routes queries across finance APIs, web search, and your documents simultaneously.",
  },
  {
    icon: FileSearch,
    title: "Multi-document RAG",
    desc: "Upload multiple PDFs — annual reports, 10-Ks, earnings transcripts — and query across all of them at once.",
  },
  {
    icon: BarChart2,
    title: "Live market data",
    desc: "Real-time stock prices, P/E ratios, market cap, and fundamentals via Yahoo Finance.",
  },
  {
    icon: Zap,
    title: "Streaming responses",
    desc: "See answers build in real time with tool execution logs and reasoning traces.",
  },
];

const EXAMPLES = [
  "Analyze Apple's last 3 earnings reports and identify risk factors",
  "Compare TSLA vs RIVIAN fundamentally — give me an investment thesis",
  "What is the market sentiment around NVIDIA this week?",
  "Here's my revenue CSV — what trends do you see?",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800/60 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-emerald-400" size={22} />
          <span className="font-bold text-lg">FinSight AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"
            className="text-sm text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-gray-800">
            Sign in
          </Link>
          <Link href="/register"
            className="text-sm bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-lg font-medium transition">
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} />
          Bloomberg Terminal meets ChatGPT — actually accessible
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-5">
          AI-powered financial<br />
          <span className="text-emerald-400">intelligence platform</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          From raw financial data to boardroom-ready insights in seconds. Upload reports,
          query live markets, and let autonomous AI agents do the research.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/register"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-semibold transition text-sm">
            Start for free <ArrowRight size={16} />
          </Link>
          <Link href="/login"
            className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-6 py-3 rounded-xl transition">
            Sign in
          </Link>
        </div>
      </section>

      {/* Example queries */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <p className="text-xs text-gray-500 text-center uppercase tracking-widest mb-5">What you can ask</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXAMPLES.map(q => (
            <div key={q} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
              &ldquo;{q}&rdquo;
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <Icon className="text-emerald-400" size={20} />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/60 py-8 text-center text-xs text-gray-600">
        FinSight AI — Built with LangChain, FastAPI, and Next.js
      </footer>
    </div>
  );
}