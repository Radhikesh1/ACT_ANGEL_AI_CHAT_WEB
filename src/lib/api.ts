import { useQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";

export class ApiError extends Error {
  response: Response;
  data: unknown;

  constructor(response: Response, data: unknown) {
    super(`Request failed with status ${response.status}`);
    this.name = "ApiError";
    this.response = response;
    this.data = data;
  }
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(path, { credentials: "include", ...init });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // ignore non-JSON body
  }
  if (!res.ok) throw new ApiError(res, data);
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useGetMe(options?: { query?: Partial<UseQueryOptions<unknown, ApiError, any>> }) {
  return useQuery<unknown, ApiError>({
    queryKey: ["me"],
    queryFn: () => fetchJson("/api/auth/me"),
    retry: false,
    ...options?.query,
  });
}

export function useLogin(options?: {
  mutation?: Partial<
    UseMutationOptions<unknown, ApiError, { data: { username: string; password: string } }>
  >;
}) {
  return useMutation<unknown, ApiError, { data: { username: string; password: string } }>({
    mutationFn: ({ data }) =>
      fetchJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

export function useLogout(options?: {
  mutation?: Partial<UseMutationOptions<unknown, ApiError, void>>;
}) {
  return useMutation<unknown, ApiError, void>({
    mutationFn: () => fetchJson("/api/auth/logout", { method: "POST" }),
    ...options?.mutation,
  });
}

// ── Chat Logs ─────────────────────────────────────────────────────────────────

export interface ChatLogsParams {
  orgId: string;
  limit?: number;
  offset?: number;
  fromDate?: string;
  toDate?: string;
  contactId?: number;
  mobile?: string;
}

export function getGetChatLogsQueryKey(params?: ChatLogsParams): unknown[] {
  return ["chat-logs", params];
}

export function useGetChatLogs(
  params?: ChatLogsParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: { query?: Partial<UseQueryOptions<unknown, ApiError, any>> },
) {
  return useQuery<unknown, ApiError>({
    queryKey: getGetChatLogsQueryKey(params),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v != null) qs.set(k, String(v));
        }
      }
      const query = qs.toString();
      return fetchJson(`/api/chat-logs${query ? `?${query}` : ""}`);
    },
    enabled: !!params,
    ...options?.query,
  });
}
