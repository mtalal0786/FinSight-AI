const TOKEN_KEY = "finsight_token";
const USER_KEY = "finsight_username";

function ls(): Storage | null {
  return typeof window !== "undefined" ? localStorage : null;
}

export const auth = {
  save: (token: string, username: string) => {
    ls()?.setItem(TOKEN_KEY, token);
    ls()?.setItem(USER_KEY, username);
  },

  clear: () => {
    ls()?.removeItem(TOKEN_KEY);
    ls()?.removeItem(USER_KEY);
  },

  token: (): string | null => ls()?.getItem(TOKEN_KEY) ?? null,

  username: (): string => ls()?.getItem(USER_KEY) ?? "User",

  isLoggedIn: (): boolean => Boolean(ls()?.getItem(TOKEN_KEY)),
};