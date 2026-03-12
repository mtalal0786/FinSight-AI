export function saveToken(token: string, username: string) {
  localStorage.setItem("finsight_token", token);
  localStorage.setItem("finsight_username", username);
}

export function clearToken() {
  localStorage.removeItem("finsight_token");
  localStorage.removeItem("finsight_username");
}

export function getUsername(): string | null {
  return localStorage.getItem("finsight_username");
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("finsight_token");
}