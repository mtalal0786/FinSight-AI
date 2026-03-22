const KEYS = {
  token: "finsight_token",
  user: "finsight_user",
};

export interface UserProfile {
  username: string;
  email: string;
  display_name: string;
  avatar_color: string;
}

export const auth = {
  save: (token: string, profile: UserProfile) => {
    localStorage.setItem(KEYS.token, token);
    localStorage.setItem(KEYS.user, JSON.stringify(profile));
  },

  saveProfile: (profile: Partial<UserProfile>) => {
    const current = auth.getProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem(KEYS.user, JSON.stringify(updated));
  },

  clear: () => {
    localStorage.removeItem(KEYS.token);
    localStorage.removeItem(KEYS.user);
  },

  token: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(KEYS.token) : null,

  getProfile: (): UserProfile => {
    if (typeof window === "undefined") {
      return { username: "User", email: "", display_name: "User", avatar_color: "#10b981" };
    }
    try {
      const raw = localStorage.getItem(KEYS.user);
      return raw ? JSON.parse(raw) : { username: "User", email: "", display_name: "User", avatar_color: "#10b981" };
    } catch {
      return { username: "User", email: "", display_name: "User", avatar_color: "#10b981" };
    }
  },

  username: (): string => auth.getProfile().username,
  displayName: (): string => auth.getProfile().display_name || auth.getProfile().username,
  avatarColor: (): string => auth.getProfile().avatar_color || "#10b981",

  isLoggedIn: (): boolean =>
    !!(typeof window !== "undefined" && localStorage.getItem(KEYS.token)),

  // Verify token is still valid with backend
  verifyWithServer: async (): Promise<boolean> => {
  const token = auth.token();
  if (!token) return false;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/verify-token`,
      {
        method: "POST",                                      // ← this fixes it
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",                // good practice
        },
        // body: JSON.stringify({})                          // usually not needed
      }
    );

    if (!res.ok) {
      auth.clear();
      return false;
    }

    const data = await res.json();
    auth.saveProfile({
      username: data.username,
      email: data.email,
      display_name: data.display_name,
      avatar_color: data.avatar_color,
    });
    return true;
  } catch {
    auth.clear();
    return false;
  }
},
};