"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { TrendingUp, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.auth.register(
        form.email,
        form.username,
        form.password
      );

      toast.success("Account created! Please log in.");

      router.push("/login");

    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
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
            <span className="text-2xl font-bold">
              FinSight AI
            </span>
          </div>

          <h1 className="text-2xl font-semibold">
            Create your account
          </h1>

          <p className="text-gray-400 mt-1">
            Free forever. No credit card needed.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5"
        >
          {[
            {
              label: "Email",
              key: "email",
              type: "email",
              placeholder: "you@example.com",
            },
            {
              label: "Username",
              key: "username",
              type: "text",
              placeholder: "johndoe",
            },
            {
              label: "Password",
              key: "password",
              type: "password",
              placeholder: "••••••••",
            },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {label}
              </label>

              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [key]: e.target.value,
                  })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition"
                placeholder={placeholder}
                required
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
          >
            {loading && (
              <Loader2
                size={18}
                className="animate-spin"
              />
            )}

            {loading
              ? "Creating account..."
              : "Create Account"}
          </button>
        </form>

        <p className="text-center text-gray-400 mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}