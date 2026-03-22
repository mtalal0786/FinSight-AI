"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { TrendingUp, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("Invalid reset link");
      router.push("/forgot-password");
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      toast.success("Password reset! Please sign in.");
      router.push("/login");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Reset failed — link may have expired");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5">
      {[
        { label: "New password", value: password, set: setPassword, placeholder: "Min 6 characters" },
        { label: "Confirm password", value: confirm, set: setConfirm, placeholder: "Repeat password" },
      ].map(({ label, value, set, placeholder }) => (
        <div key={label}>
          <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
          <input type="password" value={value} onChange={e => set(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition"
            placeholder={placeholder} required />
        </div>
      ))}
      <button type="submit" disabled={loading}
        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
        {loading && <Loader2 size={18} className="animate-spin" />}
        {loading ? "Resetting..." : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="text-emerald-400" size={28} />
            <span className="text-2xl font-bold">FinSight AI</span>
          </div>
          <h1 className="text-2xl font-semibold">Set new password</h1>
        </div>
        <Suspense fallback={<div className="text-gray-400 text-center">Loading...</div>}>
          <ResetForm />
        </Suspense>
        <div className="text-center mt-6">
          <Link href="/login" className="text-gray-400 hover:text-white text-sm transition">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}