"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, User, Lock, Palette } from "lucide-react";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

const AVATAR_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ef4444", "#ec4899", "#14b8a6", "#f97316",
];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState({ username: "", display_name: "", email: "", avatar_color: "#10b981" });
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!auth.isLoggedIn()) { router.push("/login"); return; }
    const p = auth.getProfile();
    setProfile({ username: p.username, display_name: p.display_name, email: p.email, avatar_color: p.avatar_color });
  }, [router]);

  const initials = (profile.display_name || profile.username || "U")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await api.auth.updateProfile({
        display_name: profile.display_name,
        username: profile.username,
        avatar_color: profile.avatar_color,
      });
      auth.saveProfile(profile);
      toast.success("Profile updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) { toast.error("Passwords don't match"); return; }
    if (passwords.new.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setPasswordLoading(true);
    try {
      await api.auth.changePassword(passwords.current, passwords.new);
      setPasswords({ current: "", new: "", confirm: "" });
      toast.success("Password changed");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Change failed");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800/70 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-white transition flex items-center gap-1.5 text-sm">
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <span className="text-gray-700">|</span>
        <span className="font-semibold">Profile & Settings</span>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Avatar display */}
        <div className="flex items-center gap-5 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0 text-white"
            style={{ background: profile.avatar_color }}
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold text-lg">{profile.display_name || profile.username}</p>
            <p className="text-gray-400 text-sm">{profile.email}</p>
          </div>
        </div>

        {/* Profile info */}
        <form onSubmit={handleProfileSave} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User size={15} className="text-emerald-400" />
            <h2 className="font-semibold">Profile</h2>
          </div>

          {[
            { label: "Display name", key: "display_name", placeholder: "How you appear in the app" },
            { label: "Username", key: "username", placeholder: "Your login username" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
              <input
                value={profile[key as keyof typeof profile]}
                onChange={e => setProfile(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition text-sm"
                placeholder={placeholder}
              />
            </div>
          ))}

          <div>
            <label className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
              <Palette size={13} /> Avatar color
            </label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setProfile(prev => ({ ...prev, avatar_color: color }))}
                  className={`w-8 h-8 rounded-lg transition-all ${profile.avatar_color === color ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110" : "hover:scale-105"}`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>

          <button type="submit" disabled={profileLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 rounded-xl text-sm font-semibold transition">
            {profileLoading && <Loader2 size={14} className="animate-spin" />}
            Save changes
          </button>
        </form>

        {/* Password change */}
        <form onSubmit={handlePasswordChange} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock size={15} className="text-emerald-400" />
            <h2 className="font-semibold">Change password</h2>
          </div>

          {[
            { label: "Current password", key: "current", placeholder: "Your current password" },
            { label: "New password", key: "new", placeholder: "At least 6 characters" },
            { label: "Confirm new password", key: "confirm", placeholder: "Repeat new password" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
              <input
                type="password"
                value={passwords[key as keyof typeof passwords]}
                onChange={e => setPasswords(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition text-sm"
                placeholder={placeholder}
              />
            </div>
          ))}

          <button type="submit" disabled={passwordLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl text-sm font-semibold transition">
            {passwordLoading && <Loader2 size={14} className="animate-spin" />}
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}