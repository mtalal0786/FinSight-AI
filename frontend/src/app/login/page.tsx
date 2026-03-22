"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { TrendingUp, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

type LoginResponse = {
  access_token: string;
  token_type: string;
  username: string;
  email: string;
  display_name?: string;
  avatar_color?: string;
};

export default function LoginPage() {
  const router = useRouter();

  // ✅ Updated: identifier instead of email
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = (await api.auth.login(
        identifier.trim(),
        password
      )) as LoginResponse;

      // ✅ Save full user profile
      auth.save(data.access_token, {
        username: data.username,
        email: data.email,
        display_name: data.display_name || data.username,
        avatar_color: data.avatar_color || "#10b981",
      });

      toast.success(
        `Welcome back, ${data.display_name || data.username}!`
      );

      router.push("/dashboard");

    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="text-emerald-400" size={28} />
            <span className="text-2xl font-bold">FinSight AI</span>
          </div>

          <h1 className="text-2xl font-semibold">Welcome back</h1>

          <p className="text-gray-400 mt-1 text-sm">
            Sign in with your email or username
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5"
        >
          {/* Identifier */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email or username
            </label>

            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="you@example.com or johndoe"
              autoComplete="username"
              required
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">
                Password
              </label>

              <Link
                href="/forgot-password"
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Forgot password?
              </Link>
            </div>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
          >
            {loading && (
              <Loader2 size={18} className="animate-spin" />
            )}

            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-400 mt-6 text-sm">
          No account?{" "}
          <Link
            href="/register"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Create one free
          </Link>
        </p>

      </div>
    </div>
  );
}