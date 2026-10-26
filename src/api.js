// The backend's API, from the admin site. The session token is kept in this
// browser (localStorage); a 401 or 403 forgets it, and the site goes back
// to signing in.

const TOKEN_KEY = "reelboard-admin-token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private window): signed in for this tab only.
  }
  window.dispatchEvent(new Event("admin-token"));
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const api = async (method, path, body) => {
  const token = getToken();
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the ReelBoard server", 0);
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    if (response.status === 401 && token && path !== "/auth/login") setToken(null);
    const details = data?.error?.details?.map((detail) => `${detail.path}: ${detail.message}`).join("; ");
    throw new ApiError(
      [data?.error?.message ?? `Request failed (${response.status})`, details].filter(Boolean).join(" — "),
      response.status,
    );
  }
  return data;
};

export const get = (path) => api("GET", path);

// A query string from an object, leaving out empty values.
export const query = (params) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
  const text = search.toString();
  return text ? `?${text}` : "";
};
