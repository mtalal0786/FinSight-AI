"use client";
import Link from "next/link";
import { TrendingUp, FileSearch, Zap, Shield, ArrowRight, BarChart3 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-emerald-400" size={24} />
          <span className="text-xl font-bold">FinSight AI</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="px-4 py-2 text-gray-300 hover:text-white transition">
            Login
          </Link>
          <Link href="/register" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-lg font-medium transition">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-emerald-500/20">
          <Zap size={14} />
          Powered by Gemini 2.5 Flash + LangGraph
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Financial Research,{" "}
          <span className="text-emerald-400">Supercharged by AI</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          Upload financial reports, ask complex questions, get live stock data, news,
          and fundamental analysis — all in one intelligent platform.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/register" className="flex items-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-semibold text-lg transition">
            Start for Free <ArrowRight size={18} />
          </Link>
          <Link href="/dashboard" className="flex items-center gap-2 px-8 py-3 border border-gray-700 hover:border-gray-500 rounded-xl font-semibold text-lg transition">
            Try Demo
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          {
            icon: <FileSearch className="text-emerald-400" size={28} />,
            title: "Document RAG",
            desc: "Upload 10-Ks, earnings reports, or any PDF and ask questions with full source citations.",
          },
          {
            icon: <BarChart3 className="text-blue-400" size={28} />,
            title: "Live Market Data",
            desc: "Real-time stock prices, P/E ratios, earnings history, and analyst targets.",
          },
          {
            icon: <Zap className="text-purple-400" size={28} />,
            title: "Agentic AI",
            desc: "Multi-tool AI agent that breaks down complex questions and synthesizes answers from all sources.",
          },
        ].map((f) => (
          <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition">
            <div className="mb-4">{f.icon}</div>
            <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
            <p className="text-gray-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}