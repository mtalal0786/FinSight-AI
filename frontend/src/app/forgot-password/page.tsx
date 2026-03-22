"use client";
import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { TrendingUp, Loader2, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.auth.forgotPassword(email.trim());
      setSent(true);
    } catch {
      // Always show success — don't reveal if email exists
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="text-emerald-400" size={28} />
            <span className="text-2xl font-bold">FinSight AI</span>
          </div>
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {sent ? "Check your inbox" : "Enter your email to receive a reset link"}
          </p>
        </div>

        {sent ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-emerald-400 text-xl">✓</span>
            </div>
            <p className="text-white font-medium mb-2">Reset link sent</p>
            <p className="text-gray-400 text-sm mb-6">
              If <strong>{email}</strong> is registered, you&apos;ll receive a reset link within a minute.
            </p>
            <p className="text-xs text-gray-500">
              Didn&apos;t get it? Check your spam folder or{" "}
              <button onClick={() => setSent(false)} className="text-emerald-400 hover:text-emerald-300">
                try again
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition"
                placeholder="you@example.com"
                required
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link href="/login" className="flex items-center justify-center gap-1 text-gray-400 hover:text-white text-sm transition">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}