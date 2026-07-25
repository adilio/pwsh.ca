export interface LinkRow {
  code: string;
  url: string;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  let envelope: {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  };
  try {
    envelope = await res.json();
  } catch {
    throw new ApiError(`Unexpected response (${res.status})`, "bad_response", res.status);
  }

  if (!res.ok || !envelope.success) {
    throw new ApiError(
      envelope.error?.message ?? `Request failed (${res.status})`,
      envelope.error?.code ?? "request_failed",
      res.status,
    );
  }
  return envelope.data as T;
}

export const api = {
  list: (token: string) => request<LinkRow[]>("/api/links", token),

  create: (token: string, url: string, code?: string) =>
    request<LinkRow & { shortUrl: string }>("/api/shorten", token, {
      method: "POST",
      body: JSON.stringify(code ? { url, code } : { url }),
    }),

  update: (token: string, code: string, url: string) =>
    request<LinkRow>(`/api/links/${encodeURIComponent(code)}`, token, {
      method: "PATCH",
      body: JSON.stringify({ url }),
    }),

  remove: (token: string, code: string) =>
    request<{ code: string; deleted: boolean }>(
      `/api/links/${encodeURIComponent(code)}`,
      token,
      { method: "DELETE" },
    ),
};
