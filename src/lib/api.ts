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

export function useChangePassword(options?: {
  mutation?: Partial<
    UseMutationOptions<unknown, ApiError, { currentPassword: string; newPassword: string }>
  >;
}) {
  return useMutation<unknown, ApiError, { currentPassword: string; newPassword: string }>({
    mutationFn: (data) =>
      fetchJson("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

export interface UpdateProfileData {
  displayName?: string | null;
  contactNumber?: string | null;
  birthDate?: string | null;
  country?: string | null;
  languages?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
}

export function useUpdateProfile(options?: {
  mutation?: Partial<UseMutationOptions<unknown, ApiError, UpdateProfileData>>;
}) {
  return useMutation<unknown, ApiError, UpdateProfileData>({
    mutationFn: (data) =>
      fetchJson("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title?: string;
  message: string;
  type?: string;
  read: boolean;
  createdAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export function useGetNotifications(options?: {
  query?: Partial<UseQueryOptions<unknown, ApiError, Notification[]>>;
}) {
  return useQuery<unknown, ApiError, Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => fetchJson("/api/notifications"),
    select: (data) =>
      Array.isArray(data)
        ? (data as Notification[])
        : ((data as any)?.notifications ??
          (data as any)?.data ??
          []) as Notification[],
    ...options?.query,
  });
}

export function useMarkNotificationRead(options?: {
  mutation?: Partial<UseMutationOptions<unknown, ApiError, string>>;
}) {
  return useMutation<unknown, ApiError, string>({
    mutationFn: (id) =>
      fetchJson(`/api/notifications/${id}/read`, { method: "PATCH" }),
    ...options?.mutation,
  });
}

export function useDeleteNotification(options?: {
  mutation?: Partial<UseMutationOptions<unknown, ApiError, string>>;
}) {
  return useMutation<unknown, ApiError, string>({
    mutationFn: (id) =>
      fetchJson(`/api/notifications/${id}`, { method: "DELETE" }),
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

// ── Assistants ────────────────────────────────────────────────────────────────

export interface Assistant {
  id: string;
  name: string;
  system_prompt: string;
  welcome_message: string;
  default_language: string;
  voice: string;
  llm_model: string;
  temperature: number;
  business_hours_start: string;
  business_hours_end: string;
  status: "development" | "production";
  created_at: string;
  updated_at: string;
}

export interface AssistantInput {
  name: string;
  system_prompt: string;
  welcome_message?: string;
  default_language?: string;
  voice?: string;
  llm_model?: string;
  temperature?: number;
  business_hours_start?: string;
  business_hours_end?: string;
}

export function useGetAssistants(options?: {
  query?: Partial<UseQueryOptions<unknown, ApiError, Assistant[]>>;
}) {
  return useQuery<unknown, ApiError, Assistant[]>({
    queryKey: ["assistants"],
    queryFn: () => fetchJson("/api/assistants"),
    select: (data) => (Array.isArray(data) ? (data as Assistant[]) : []),
    ...options?.query,
  });
}

export function useGetAssistant(
  id: string | undefined,
  options?: { query?: Partial<UseQueryOptions<unknown, ApiError, Assistant>> },
) {
  return useQuery<unknown, ApiError, Assistant>({
    queryKey: ["assistants", id],
    queryFn: () => fetchJson(`/api/assistants/${id}`),
    select: (data) => data as Assistant,
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreateAssistant(options?: {
  mutation?: Partial<UseMutationOptions<Assistant, ApiError, AssistantInput>>;
}) {
  return useMutation<Assistant, ApiError, AssistantInput>({
    mutationFn: (data) =>
      fetchJson("/api/assistants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }) as Promise<Assistant>,
    ...options?.mutation,
  });
}

export function useUpdateAssistant(options?: {
  mutation?: Partial<
    UseMutationOptions<Assistant, ApiError, { id: string; data: Partial<AssistantInput> }>
  >;
}) {
  return useMutation<Assistant, ApiError, { id: string; data: Partial<AssistantInput> }>({
    mutationFn: ({ id, data }) =>
      fetchJson(`/api/assistants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }) as Promise<Assistant>,
    ...options?.mutation,
  });
}

export function useDeleteAssistant(options?: {
  mutation?: Partial<UseMutationOptions<unknown, ApiError, string>>;
}) {
  return useMutation<unknown, ApiError, string>({
    mutationFn: (id) =>
      fetchJson(`/api/assistants/${id}`, { method: "DELETE" }),
    ...options?.mutation,
  });
}

export function usePublishAssistant(options?: {
  mutation?: Partial<UseMutationOptions<Assistant, ApiError, string>>;
}) {
  return useMutation<Assistant, ApiError, string>({
    mutationFn: (id) =>
      fetchJson(`/api/assistants/${id}/publish`, { method: "POST" }) as Promise<Assistant>,
    ...options?.mutation,
  });
}

export function useUnpublishAssistant(options?: {
  mutation?: Partial<UseMutationOptions<Assistant, ApiError, string>>;
}) {
  return useMutation<Assistant, ApiError, string>({
    mutationFn: (id) =>
      fetchJson(`/api/assistants/${id}/unpublish`, { method: "POST" }) as Promise<Assistant>,
    ...options?.mutation,
  });
}

// ── Phone Numbers ─────────────────────────────────────────────────────────────

export interface PlivoNumber {
  number: string;
  friendly_name: string;
  country: string;
  number_type: string;
  assistant_id: string | null;
  assistant_name: string | null;
  webhook_configured: boolean;
}

export function useGetNumbers(options?: {
  query?: Partial<UseQueryOptions<unknown, ApiError, PlivoNumber[]>>;
}) {
  return useQuery<unknown, ApiError, PlivoNumber[]>({
    queryKey: ["numbers"],
    queryFn: () => fetchJson("/api/numbers"),
    select: (data) => (Array.isArray(data) ? (data as PlivoNumber[]) : []),
    ...options?.query,
  });
}

export function useAssignNumber(options?: {
  mutation?: Partial<
    UseMutationOptions<unknown, ApiError, { number: string; assistantId: string }>
  >;
}) {
  return useMutation<unknown, ApiError, { number: string; assistantId: string }>({
    mutationFn: ({ number, assistantId }) =>
      fetchJson(`/api/numbers/${encodeURIComponent(number)}/assign/${assistantId}`, {
        method: "POST",
      }),
    ...options?.mutation,
  });
}

export function useUnassignNumber(options?: {
  mutation?: Partial<UseMutationOptions<unknown, ApiError, string>>;
}) {
  return useMutation<unknown, ApiError, string>({
    mutationFn: (number) =>
      fetchJson(`/api/numbers/${encodeURIComponent(number)}/unassign`, { method: "POST" }),
    ...options?.mutation,
  });
}
