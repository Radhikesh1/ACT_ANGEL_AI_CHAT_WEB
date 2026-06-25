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
  prefetch_webhook_url: string | null;
  end_of_call_webhook_url: string | null;
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
  prefetch_webhook_url?: string | null;
  end_of_call_webhook_url?: string | null;
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

// ── Call Logs ─────────────────────────────────────────────────────────────────

export interface CallLogMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CallCostBreakdown {
  llm_usd: number;
  stt_usd: number;
  phone_usd: number;
  platform_usd: number;
  total_usd: number;
  tokens: { input: number; output: number };
  rates: {
    llm_input_per_1m: number;
    llm_output_per_1m: number;
    stt_per_min: number;
    phone_per_min: number;
    platform_per_min: number;
  };
  model: string;
  duration_min: number;
}

export interface CallLog {
  id: string;
  session_id: string;
  assistant_id: string | null;
  assistant_name: string;
  from_number: string;
  to_number: string;
  duration: number;
  chat: string | null;
  call_status: string;
  error_message: string | null;
  chars_used: number;
  recording_url: string | null;
  cost_breakdown: CallCostBreakdown | null;
  total_cost: number | null;
  started_at: string;
  ended_at: string;
}

export function useGetCallLogs(options?: {
  query?: Partial<UseQueryOptions<unknown, ApiError, CallLog[]>>;
}) {
  return useQuery<unknown, ApiError, CallLog[]>({
    queryKey: ["call-logs"],
    queryFn: () => fetchJson("/api/call-logs"),
    select: (data) => (Array.isArray(data) ? (data as CallLog[]) : []),
    ...options?.query,
  });
}

export function useGetCallLog(
  id: string | undefined,
  options?: { query?: Partial<UseQueryOptions<unknown, ApiError, CallLog>> },
) {
  return useQuery<unknown, ApiError, CallLog>({
    queryKey: ["call-logs", id],
    queryFn: () => fetchJson(`/api/call-logs/${id}`),
    select: (data) => data as CallLog,
    enabled: !!id,
    ...options?.query,
  });
}

// ── Plivo Settings ────────────────────────────────────────────────────────────

export interface PlivoSettings {
  plivo_auth_id: string;
  plivo_auth_token: string;
  plivo_phone_number: string;
  domain: string;
  source: Record<string, "db" | "env">;
}

export interface PlivoSettingsInput {
  plivo_auth_id?: string;
  plivo_auth_token?: string;
  plivo_phone_number?: string;
  domain?: string;
}

export function useGetPlivoSettings(options?: {
  query?: Partial<UseQueryOptions<unknown, ApiError, PlivoSettings>>;
}) {
  return useQuery<unknown, ApiError, PlivoSettings>({
    queryKey: ["plivo-settings"],
    queryFn: () => fetchJson("/api/settings/plivo"),
    select: (data) => data as PlivoSettings,
    ...options?.query,
  });
}

export function useUpdatePlivoSettings(options?: {
  mutation?: Partial<UseMutationOptions<unknown, ApiError, PlivoSettingsInput>>;
}) {
  return useMutation<unknown, ApiError, PlivoSettingsInput>({
    mutationFn: (data) =>
      fetchJson("/api/settings/plivo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
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

export function useLookupNumber(options?: {
  mutation?: Partial<UseMutationOptions<PlivoNumber, ApiError, string>>;
}) {
  return useMutation<PlivoNumber, ApiError, string>({
    mutationFn: (number) =>
      fetchJson("/api/numbers/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number }),
      }) as Promise<PlivoNumber>,
    ...options?.mutation,
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

export function useDeleteNumber(options?: {
  mutation?: Partial<UseMutationOptions<unknown, ApiError, string>>;
}) {
  return useMutation<unknown, ApiError, string>({
    mutationFn: (number) =>
      fetchJson(`/api/numbers/${encodeURIComponent(number)}`, { method: "DELETE" }),
    ...options?.mutation,
  });
}
