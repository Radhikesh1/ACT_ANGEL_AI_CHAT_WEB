import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search,
  LogOut,
  Phone,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Send,
  Building2,
  ArrowDown,
  Headphones,
  User,
  Paperclip,
  FileText,
  Mic,
  StopCircle,
  RefreshCw,
  X,
  Bell,
  Menu,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useGetMe,
  useLogout,
  useGetChatLogs,
  getGetChatLogsQueryKey,
  useGetNotifications,
  useMarkNotificationRead,
  useDeleteNotification,
  ApiError,
  type Notification,
} from "@/lib/api";
import { Logo } from "@/components/Logo";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow, fromUnixTime, parseISO, isValid } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface AttachmentData {
  url: string;
  type: "image" | "document" | "audio";
  filename: string;
  size: number;
  duration?: number;
  mimeType?: string;
  caption?: string;
}

interface PendingAttachment {
  file: File;
  previewUrl?: string;
  type: "image" | "document" | "audio";
}

interface ActMessage {
  id: string;
  isAssistant?: boolean;
  text?: string;
  content?: string;
  body?: string;
  role?: "user" | "assistant" | "human";
  direction?: "inbound" | "outbound";
  from?: string;
  timestamp?: number | string;
  createdAt?: string;
  agentName?: string;
  type?: string;
  mediaUrl?: string;
  mediaMetadata?: { fileName?: string; fileSize?: number; mimeType?: string };
  attachments?: AttachmentData[];
}

interface ActChatItem {
  id: string;
  recipientName?: string;
  recipientNumber?: string;
  contactId?: string;
  date?: string;
  messages?: ActMessage[];
  organizationId?: string;
  sessionId?: string;
  usageId?: string;
  humanRequested?: boolean;
  resumeUrl?: string;
}

interface DisplayMessage {
  id: string;
  isAssistant: boolean;
  agentName: string | null;
  text: string;
  timestamp: Date | null;
  isPending?: boolean;
  type?: string;
  mediaUrl?: string;
  mediaMetadata?: { fileName?: string; fileSize?: number; mimeType?: string };
  attachments?: AttachmentData[];
}

interface Organisation {
  id: string;
  name: string;
  slug?: string;
  logo?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    contactId: p.get("contact") ?? undefined,
    mobile: p.get("mobile") ?? undefined,
  };
}

function displayName(item: ActChatItem): string {
  const name = item.recipientName ?? "";
  const phone = item.recipientNumber ?? "";
  if (name && name !== phone) return name;
  return phone || "Unknown";
}

function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function msgContent(msg: ActMessage): string {
  return msg.text ?? msg.content ?? msg.body ?? "";
}

function msgTime(msg: ActMessage): Date | null {
  try {
    if (msg.timestamp != null) {
      const raw = msg.timestamp;
      if (typeof raw === "string") {
        if (/[A-Za-z\-]/.test(raw)) {
          const d = parseISO(raw);
          if (isValid(d)) return d;
        } else {
          const t = parseInt(raw, 10);
          if (!isNaN(t) && t > 1_000_000) {
            const d = fromUnixTime(t);
            if (isValid(d)) return d;
          }
        }
      } else if (typeof raw === "number" && raw > 1_000_000) {
        const d = fromUnixTime(raw);
        if (isValid(d)) return d;
      }
    }
    if (msg.createdAt) {
      const d = parseISO(msg.createdAt);
      if (isValid(d)) return d;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isUserMsg(msg: ActMessage, recipientNumber?: string): boolean {
  if (msg.role === "user") return true;
  if (msg.role === "assistant") return false;
  if (msg.direction === "inbound") return true;
  if (msg.direction === "outbound") return false;
  if (
    msg.from &&
    recipientNumber &&
    msg.from.replace(/\D/g, "") === recipientNumber.replace(/\D/g, "")
  )
    return true;
  return false;
}

function isHumanAgent(msg: ActMessage): boolean {
  return msg.role === "human";
}

function lastMsg(item: ActChatItem): { text: string; time: Date | null } {
  const msgs = item.messages ?? [];
  if (msgs.length === 0) return { text: "No messages yet", time: null };
  const last = msgs[msgs.length - 1];
  return { text: msgContent(last) || "No messages yet", time: msgTime(last) };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ORG_STORAGE_KEY = "actangel_selected_org";

function loadStoredOrg(): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem(ORG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Org Picker ───────────────────────────────────────────────────────────────

function OrgPicker({
  onSelect,
  onLogout,
}: {
  onSelect: (org: Organisation) => void;
  onLogout: () => void;
}) {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/organizations", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          window.location.href = "/login";
          return;
        }
        if (!r.ok) throw new Error(`Server error (HTTP ${r.status})`);

        const text = await r.text();
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Unexpected response from server. Please try again.");
        }

        const list: Organisation[] = Array.isArray(data)
          ? data
          : ((data as any).items ??
            (data as any).data ??
            (data as any).organizations ??
            []);
        setOrgs(list);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Failed to load organisations",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      <header className="h-14 md:h-16 bg-card border-b border-border shadow-sm flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <Logo className="w-6 h-6 md:w-7 md:h-7 object-contain" />
          <span className="font-bold text-primary font-['Plus_Jakarta_Sans'] text-base md:text-lg tracking-tight">
            Act Angel AI
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Log Out</span>
        </Button>
      </header>

      <div className="flex-1 flex items-start md:items-center justify-center p-4 md:p-6 overflow-y-auto">
        <div className="w-full max-w-lg pt-4 md:pt-0">
          <div className="mb-6 md:mb-8">
            <h1 className="text-xl md:text-2xl font-bold font-['Plus_Jakarta_Sans'] text-foreground mb-1">
              Select Organisation
            </h1>
            <p className="text-muted-foreground text-sm">
              You are logged in as Super Admin. Choose which organisation to
              manage.
            </p>
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium mb-1">Could not load organisations</p>
              <p className="text-xs opacity-80">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && orgs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No organisations found.
            </div>
          )}

          {!loading && !error && orgs.length > 0 && (
            <div className="space-y-3">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => onSelect(org)}
                  className="w-full p-4 border border-border rounded-xl text-left hover:border-primary hover:bg-primary/10 active:bg-primary/15 transition-all group flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground font-['Plus_Jakarta_Sans']">
                      {org.name}
                    </div>
                    {org.slug && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {org.slug}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Chat Component ───────────────────────────────────────────────────────

export default function ChatPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [listSearch, setListSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Messaging state
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<DisplayMessage[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Org selection state for Super Admin
  const [selectedOrg, setSelectedOrg] = useState<{
    id: string;
    name: string;
  } | null>(loadStoredOrg);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoSelectedRef = useRef(false);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const { contactId, mobile } = useMemo(() => getUrlParams(), []);

  // Auth guard
  const { data: user, error: userError } = useGetMe();
  useEffect(() => {
    if (
      userError instanceof ApiError &&
      [401, 403].includes(userError.response.status)
    ) {
      window.location.href = "/login";
    }
  }, [userError]);

  const { mutate: logout } = useLogout({
    mutation: {
      onSuccess: () => {
        localStorage.removeItem(ORG_STORAGE_KEY);
        window.location.href = "/login";
      },
    },
  });

  // ── Notifications ──────────────────────────────────────────────────────────
  const { data: notificationsData } = useGetNotifications({
    query: { refetchInterval: 30000, enabled: !!user },
  });
  const notificationsList: Notification[] = notificationsData ?? [];
  const unreadCount = notificationsList.filter((n) => !n.read).length;

  const { mutate: markReadMutation } = useMarkNotificationRead({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    },
  });
  const { mutate: deleteNotificationMutation } = useDeleteNotification({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    },
  });

  const markNotifRead = (id: string) => markReadMutation(id);
  const markAllRead = () =>
    notificationsList
      .filter((n) => !n.read)
      .forEach((n) => markReadMutation(n.id));
  const dismissNotif = (id: string) => deleteNotificationMutation(id);

  // Derived values
  const isSuperAdmin =
    !!user &&
    ((user as any).role === "SAD" || (user as any).role === "SUPER_ADMIN");
  const userOrgId = user
    ? ((user as any).organizationId ?? (user as any).orgId ?? null)
    : null;
  const orgId: string | null = userOrgId ?? selectedOrg?.id ?? null;
  const needsOrgSelection =
    !!user && !!isSuperAdmin && !userOrgId && !selectedOrg;

  function handleOrgSelect(org: Organisation) {
    const stored = { id: org.id, name: org.name };
    setSelectedOrg(stored);
    localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(stored));
  }

  function handleSwitchOrg() {
    setSelectedOrg(null);
    localStorage.removeItem(ORG_STORAGE_KEY);
    setSelectedId(null);
    autoSelectedRef.current = false;
  }

  const queryParams = useMemo(() => {
    if (!user || !orgId) return undefined;
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const toDate = fmt(new Date());
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = fmt(sixMonthsAgo);
    return {
      orgId,
      limit: 25,
      offset: 0,
      fromDate,
      toDate,
      ...(contactId ? { contactId: Number(contactId) } : {}),
      ...(mobile ? { mobile } : {}),
    };
  }, [user, orgId, contactId, mobile]);

  const { data: chatLogsResponse, isLoading: isLoadingLogs } = useGetChatLogs(
    queryParams,
    {
      query: {
        enabled: !!queryParams,
        queryKey: getGetChatLogsQueryKey(queryParams),
      },
    },
  );

  const chatLogs: ActChatItem[] = useMemo(() => {
    if (!chatLogsResponse) return [];
    const r = chatLogsResponse as any;
    return Array.isArray(r) ? r : (r.items ?? r.data ?? r.chatLogs ?? []);
  }, [chatLogsResponse]);

  const totalCount = useMemo(() => {
    if (!chatLogsResponse) return 0;
    const r = chatLogsResponse as any;
    return r.totalCount ?? r.total ?? chatLogs.length;
  }, [chatLogsResponse, chatLogs.length]);

  const filteredLogs = useMemo(
    () =>
      chatLogs.filter((log) =>
        displayName(log).toLowerCase().includes(listSearch.toLowerCase()),
      ),
    [chatLogs, listSearch],
  );

  // Auto-select based on URL params
  useEffect(() => {
    if (autoSelectedRef.current || chatLogs.length === 0) return;
    if (mobile) {
      const digits = (s: string) => s.replace(/\D/g, "");
      const target = digits(mobile);
      const match = chatLogs.find(
        (log) =>
          log.recipientNumber && digits(log.recipientNumber).includes(target),
      );
      if (match) {
        autoSelectedRef.current = true;
        setSelectedId(match.id);
      }
    } else if (contactId) {
      const match = chatLogs.find(
        (log) => log.contactId === contactId || log.id === contactId,
      );
      if (match) {
        autoSelectedRef.current = true;
        setSelectedId(match.id);
      } else if (filteredLogs.length > 0) {
        autoSelectedRef.current = true;
        setSelectedId(filteredLogs[0].id);
      }
    }
  }, [chatLogs, filteredLogs, contactId, mobile]);

  const selectedChat = useMemo(
    () => chatLogs.find((log) => log.id === selectedId) ?? null,
    [chatLogs, selectedId],
  );

  // Derived messaging flags
  const humanRequested = !!(selectedChat as any)?.humanRequested;

  // Clear pending messages and scroll state when switching conversations
  useEffect(() => {
    setPendingMessages([]);
    setShouldAutoScroll(true);
    setShowScrollButton(false);
    setTranscriptSearch("");
    setMessage("");
    isUserScrollingRef.current = false;
  }, [selectedId]);

  // Build display messages from server data
  const serverDisplayMessages: DisplayMessage[] = useMemo(() => {
    if (!selectedChat) return [];
    return (selectedChat.messages ?? [])
      .filter(
        (msg) =>
          msgContent(msg) ||
          msg.mediaUrl ||
          (msg.attachments && msg.attachments.length > 0),
      )
      .map((msg) => {
        let assistant: boolean;
        if (typeof msg.isAssistant === "boolean") {
          assistant = msg.isAssistant;
        } else {
          assistant = !isUserMsg(msg, selectedChat.recipientNumber);
        }
        const agentLabel =
          msg.agentName ?? (isHumanAgent(msg) ? "RM Agent" : null);
        return {
          id: msg.id,
          isAssistant: assistant,
          agentName: assistant && agentLabel ? agentLabel : null,
          text: msgContent(msg),
          timestamp: msgTime(msg),
          type: msg.type,
          mediaUrl: msg.mediaUrl,
          mediaMetadata: msg.mediaMetadata,
          attachments: msg.attachments,
        };
      });
  }, [selectedChat]);

  // Merge server messages with pending (optimistic) messages, deduplicating by text
  const displayMessages: DisplayMessage[] = useMemo(() => {
    const serverTexts = new Set(serverDisplayMessages.map((m) => m.text));
    const uniquePending = pendingMessages.filter(
      (p) => !serverTexts.has(p.text),
    );
    return [...serverDisplayMessages, ...uniquePending];
  }, [serverDisplayMessages, pendingMessages]);

  // ── Auto-refresh (poll every 5 s when a conversation is open) ──────────────
  useEffect(() => {
    if (!selectedId || !queryParams) return;

    let running = false;

    const doRefresh = async () => {
      if (running) return;
      running = true;
      setIsAutoRefreshing(true);
      try {
        await queryClient.invalidateQueries({
          queryKey: getGetChatLogsQueryKey(queryParams),
        });
      } catch {
        /* ignore */
      } finally {
        setIsAutoRefreshing(false);
        running = false;
      }
    };

    refreshTimerRef.current = setInterval(doRefresh, 5000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      setIsAutoRefreshing(false);
    };
  }, [selectedId, queryParams, queryClient]);

  // ── Scroll helpers ─────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
      }
    });
  }, []);

  // Scroll to bottom when messages update AND user hasn't scrolled away
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    const count = displayMessages.length;
    if (count > prevMessageCountRef.current && shouldAutoScroll) {
      scrollToBottom("smooth");
    }
    prevMessageCountRef.current = count;
  }, [displayMessages.length, shouldAutoScroll, scrollToBottom]);

  // Initial scroll when switching conversations
  useEffect(() => {
    scrollToBottom("auto");
  }, [selectedId, scrollToBottom]);

  // Detect user scrolling
  const handleChatScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;

    setShowScrollButton(!isAtBottom);

    if (!isAtBottom) {
      isUserScrollingRef.current = true;
      setShouldAutoScroll(false);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 5000);
    } else {
      isUserScrollingRef.current = false;
      setShouldAutoScroll(true);
    }
  }, []);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleChatScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleChatScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [selectedId, handleChatScroll]);

  // ── Transcript search ──────────────────────────────────────────────────────
  const searchMatches = useMemo(() => {
    const q = transcriptSearch.trim().toLowerCase();
    if (!q) return [] as DisplayMessage[];
    return displayMessages.filter((m) => m.text.toLowerCase().includes(q));
  }, [displayMessages, transcriptSearch]);

  const totalMatches = searchMatches.length;

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [transcriptSearch]);

  useEffect(() => {
    if (searchMatches.length === 0) return;
    const match = searchMatches[currentMatchIndex];
    if (match)
      messageRefs.current[match.id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [currentMatchIndex, searchMatches]);

  const goToNextMatch = useCallback(
    () => setCurrentMatchIndex((i) => (i + 1) % totalMatches),
    [totalMatches],
  );
  const goToPrevMatch = useCallback(
    () => setCurrentMatchIndex((i) => (i - 1 + totalMatches) % totalMatches),
    [totalMatches],
  );

  function highlightText(text: string) {
    const q = transcriptSearch.trim();
    if (!q) return <>{text}</>;
    const parts = text.split(new RegExp(`(${escapeRegex(q)})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase() ? (
            <mark
              key={i}
              className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5"
            >
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </>
    );
  }

  // ── File upload & recording helpers ───────────────────────────────────────
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const uploadFile = async (file: File): Promise<AttachmentData> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success)
      throw new Error(data.error || "Upload failed");
    return data.data as AttachmentData;
  };

  const handleFileSelect =
    (type: "image" | "document") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const previewUrl =
        type === "image" ? URL.createObjectURL(file) : undefined;
      setPendingAttachments((prev) => [...prev, { file, previewUrl, type }]);
      e.target.value = "";
    };

  const removeAttachment = (index: number) => {
    setPendingAttachments((prev) => {
      const next = [...prev];
      if (next[index].previewUrl) URL.revokeObjectURL(next[index].previewUrl!);
      next.splice(index, 1);
      return next;
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice_${Date.now()}.webm`, {
          type: "audio/webm",
        });
        const previewUrl = URL.createObjectURL(blob);
        setPendingAttachments((prev) => [
          ...prev,
          { file, previewUrl, type: "audio" },
        ]);
        setIsRecording(false);
        setRecordingDuration(0);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(
        () => setRecordingDuration((d) => d + 1),
        1000,
      );
    } catch {
      toast.error("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!humanRequested || isSending) return;
    if (!message.trim() && pendingAttachments.length === 0) return;

    const msgText = message.trim();
    setIsSending(true);
    setMessage("");
    const attsCopy = [...pendingAttachments];
    setPendingAttachments([]);

    // Upload attachments first
    let uploaded: AttachmentData[] = [];
    for (const att of attsCopy) {
      try {
        const result = await uploadFile(att.file);
        uploaded.push(result);
      } catch {
        toast.error(`Failed to upload ${att.file.name}`);
        setIsSending(false);
        setPendingAttachments(attsCopy);
        return;
      }
    }

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimistic: DisplayMessage = {
      id: tempId,
      isAssistant: true,
      agentName: "RM Agent",
      text: msgText,
      timestamp: new Date(),
      isPending: true,
      attachments: uploaded.length > 0 ? uploaded : undefined,
    };
    setPendingMessages((prev) => [...prev, optimistic]);

    // Force scroll to bottom for new message
    setShouldAutoScroll(true);
    isUserScrollingRef.current = false;
    scrollToBottom("smooth");

    try {
      const res = await fetch("/api/chat/send-human-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phoneNumber: selectedChat?.recipientNumber,
          message: msgText,
          agentName: "RM Agent",
          sessionId: selectedChat?.sessionId,
          chatId: selectedId,
          attachments: uploaded.length > 0 ? uploaded : undefined,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        /* ignore non-JSON */
      }

      if (res.ok && data.success !== false) {
        toast.success("Message sent!");
        // Remove the optimistic copy; server data will appear on next refresh
        setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
        // Trigger immediate refresh to confirm
        if (queryParams) {
          queryClient.invalidateQueries({
            queryKey: getGetChatLogsQueryKey(queryParams),
          });
        }
      } else {
        setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error(data.error || "Failed to send message");
      }
    } catch {
      setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // ── Rendering ──────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (needsOrgSelection) {
    return <OrgPicker onSelect={handleOrgSelect} onLogout={() => logout()} />;
  }

  const displayUserName =
    (user as any).displayName || (user as any).name || (user as any).username;
  const orgDisplayName: string =
    selectedOrg?.name ||
    (user as any).organizationName ||
    (user as any).orgName ||
    (user as any).organization?.name ||
    "";
  const showConvo = !!selectedId;

  return (
    <div className="h-screen w-full flex flex-col bg-background font-sans overflow-hidden">
      {/* ── Header ── */}
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
        {/* Left: Menu + Logo */}
        <div className="flex items-center gap-3">
          <button
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <Logo className="w-6 h-6 object-contain shrink-0" />
          <span className="hidden lg:block font-bold text-primary font-['Plus_Jakarta_Sans'] text-base tracking-tight">
            Act Angel AI
          </span>
        </div>

        {/* Right: Org selector + Bell + Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Org selector — bordered pill */}
          {orgDisplayName && (
            <button
              onClick={
                isSuperAdmin && selectedOrg ? handleSwitchOrg : undefined
              }
              className={`hidden sm:flex items-center gap-2 h-9 px-3 border border-border rounded-lg text-sm font-medium transition-colors ${
                isSuperAdmin && selectedOrg
                  ? "hover:bg-primary/10 hover:text-primary cursor-pointer"
                  : "cursor-default"
              }`}
            >
              {/* <Building2 className="w-4 h-4 text-muted-foreground shrink-0" /> */}
              <span className="max-w-[160px] truncate">{orgDisplayName}</span>
              {isSuperAdmin && selectedOrg && (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
            </button>
          )}

          {/* Notification Bell — bordered button + Popover panel */}
          <Popover open={showNotifications} onOpenChange={setShowNotifications}>
            <PopoverTrigger asChild>
              <button
                className="relative h-9 w-9 flex items-center justify-center border border-border rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-72 md:w-80 p-0 rounded-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm font-['Plus_Jakarta_Sans']">
                  Notifications
                </span>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-72">
                {notificationsList.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    You have no new notifications.
                  </div>
                ) : (
                  notificationsList.map((notif) => (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 border-b border-border/50 last:border-0 ${
                        !notif.read ? "bg-primary/5" : ""
                      }`}
                    >
                      {notif.title && (
                        <p className="text-xs font-semibold text-foreground mb-0.5">
                          {notif.title}
                        </p>
                      )}
                      <p className="text-xs text-foreground leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {!notif.read && (
                            <button
                              onClick={() => markNotifRead(notif.id)}
                              className="text-[10px] text-primary hover:underline font-medium"
                            >
                              Mark read
                            </button>
                          )}
                          <button
                            onClick={() => dismissNotif(notif.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Dismiss"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {notificationsList.some((n) => !n.read) && (
                <div className="px-4 py-2.5 border-t border-border">
                  <button
                    onClick={markAllRead}
                    className="w-full text-xs text-primary hover:underline font-medium"
                  >
                    Mark All as Read
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Avatar — circular, opens user dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-9 w-9 rounded-full border-2 border-border hover:border-primary hover:ring-2 hover:ring-primary/20 transition-colors overflow-hidden shrink-0"
                aria-label="User menu"
              >
                <Avatar className="h-full w-full">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                    {getInitials(displayUserName || "U")}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold truncate">
                  {displayUserName}
                </p>
                {(user as any).email && (
                  <p className="text-xs text-muted-foreground truncate">
                    {(user as any).email}
                  </p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/profile")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              {isSuperAdmin && selectedOrg && (
                <DropdownMenuItem onClick={handleSwitchOrg}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Switch Organisation
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Main body ── */}
      <main className="flex-1 flex overflow-hidden">
        {/* ── Left Panel: Chat List ── */}
        <aside
          className={`
            bg-card border-r border-border flex flex-col shrink-0
            w-full md:w-72 lg:w-80
            ${showConvo ? "hidden md:flex" : "flex"}
          `}
        >
          <div className="p-3 md:p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="font-semibold text-base md:text-lg font-['Plus_Jakarta_Sans']">
                Chats
              </h2>
              <Badge
                variant="secondary"
                className="bg-secondary text-secondary-foreground"
              >
                {totalCount}
              </Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-9 bg-background border-input rounded-lg h-9 text-sm"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingLogs ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No conversations found.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredLogs.map((log) => {
                  const name = displayName(log);
                  const { text, time } = lastMsg(log);
                  return (
                    <button
                      key={log.id}
                      onClick={() => setSelectedId(log.id)}
                      className={`w-full p-3 md:p-4 flex items-start gap-3 text-left transition-colors hover:bg-primary/10 active:bg-primary/15 ${
                        selectedId === log.id
                          ? "bg-primary/10 hover:bg-primary/10"
                          : ""
                      }`}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex justify-between items-baseline mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium text-sm truncate text-foreground font-['Plus_Jakarta_Sans']">
                              {name}
                            </span>
                            {log.humanRequested && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-[10px] font-medium rounded-full">
                                <Headphones className="w-2.5 h-2.5" />
                                HR
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                            {time && isValid(time)
                              ? formatDistanceToNow(time, { addSuffix: true })
                              : (log.date ?? "")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {text}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── Right Panel: Conversation ── */}
        <section
          className={`
            bg-background flex-col min-w-0
            ${showConvo ? "flex flex-1" : "hidden md:flex md:flex-1"}
          `}
        >
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
              <div className="bg-card p-5 md:p-6 rounded-full shadow-sm mb-4">
                <Logo className="w-10 h-10 md:w-12 md:h-12 object-contain opacity-80" />
              </div>
              <h3 className="text-base md:text-lg font-medium text-foreground font-['Plus_Jakarta_Sans'] mb-2">
                No Conversation Selected
              </h3>
              <p className="text-sm text-center">
                Select a conversation from the left to view messages
              </p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="bg-card border-b border-border px-3 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 shrink-0 shadow-sm z-10">
                {!mobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden -ml-1 shrink-0"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                )}

                <Avatar className="h-10 w-10 md:h-12 md:w-12 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-base md:text-lg">
                    {getInitials(displayName(selectedChat))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base md:text-xl font-semibold font-['Plus_Jakarta_Sans'] text-foreground truncate">
                      {displayName(selectedChat)}
                    </h2>
                    {humanRequested && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-xs font-medium rounded-full shrink-0">
                        <Headphones className="w-3 h-3" />
                        Human Requested
                      </span>
                    )}
                    {isAutoRefreshing && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full shrink-0">
                        <svg
                          className="animate-spin h-3 w-3"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Syncing
                      </span>
                    )}
                  </div>
                  {selectedChat.recipientNumber && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="w-3 h-3 shrink-0" />
                      {selectedChat.recipientNumber.replace(/^\d{8}/, (match) =>
                        "*".repeat(match.length),
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Search transcript bar */}
              <div className="bg-card border-b border-border px-3 md:px-4 py-2 md:py-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Search transcript"
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="pr-9 text-sm h-9"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  {totalMatches > 0 && (
                    <div className="flex items-center gap-0.5 bg-muted rounded-lg px-1.5 py-1">
                      <span className="text-xs font-medium whitespace-nowrap px-1">
                        {currentMatchIndex + 1}/{totalMatches}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={goToPrevMatch}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={goToNextMatch}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 relative overflow-hidden flex flex-col">
                <div
                  ref={chatContainerRef}
                  className="flex-1 px-3 md:px-4 py-3 md:py-4 overflow-y-auto scroll-smooth bg-background"
                >
                  <div className="space-y-3 max-w-3xl mx-auto">
                    {displayMessages.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        No messages in this conversation.
                      </div>
                    ) : (
                      displayMessages.map((msg) => (
                        <div
                          key={msg.id}
                          ref={(el) => {
                            messageRefs.current[msg.id] = el;
                          }}
                          className={`flex ${msg.isAssistant ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[85%] md:max-w-[80%] px-3 md:px-4 py-2 rounded-2xl text-sm transition-all ${
                              msg.isAssistant
                                ? "bg-primary text-primary-foreground shadow-lg"
                                : "bg-zinc-200 dark:bg-zinc-700 text-foreground shadow-sm"
                            } ${
                              searchMatches[currentMatchIndex]?.id === msg.id
                                ? "ring-2 ring-primary ring-offset-2"
                                : ""
                            } ${msg.isPending ? "opacity-70" : ""}`}
                          >
                            {msg.isAssistant && msg.agentName && (
                              <div className="text-xs opacity-70 mb-1">
                                👤 {msg.agentName}
                                {msg.isPending ? " (sending…)" : ""}
                              </div>
                            )}
                            {/* RM-sent attachments */}
                            {msg.attachments?.map((att, i) => (
                              <div key={i} className="mb-1.5">
                                {att.type === "image" ? (
                                  <img
                                    src={att.url}
                                    alt={att.caption || att.filename}
                                    className="max-w-[220px] rounded-lg"
                                  />
                                ) : att.type === "audio" ? (
                                  <audio
                                    controls
                                    src={att.url}
                                    className="h-8 max-w-[200px]"
                                  />
                                ) : (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 underline text-xs opacity-90"
                                  >
                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                    {att.filename}
                                    {att.size > 0 && (
                                      <span className="opacity-70">
                                        ({formatFileSize(att.size)})
                                      </span>
                                    )}
                                  </a>
                                )}
                              </div>
                            ))}
                            {/* Customer-sent media (WhatsApp) */}
                            {!msg.attachments?.length && msg.mediaUrl && (
                              <div className="mb-1.5">
                                {msg.type === "image" ? (
                                  <img
                                    src={msg.mediaUrl}
                                    alt={msg.mediaMetadata?.fileName || "Image"}
                                    className="max-w-[220px] rounded-lg"
                                  />
                                ) : msg.type === "voice" ||
                                  msg.mediaMetadata?.mimeType?.startsWith(
                                    "audio",
                                  ) ? (
                                  <audio
                                    controls
                                    src={msg.mediaUrl}
                                    className="h-8 max-w-[200px]"
                                  />
                                ) : (
                                  <a
                                    href={msg.mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 underline text-xs opacity-90"
                                  >
                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                    {msg.mediaMetadata?.fileName ||
                                      "Download file"}
                                  </a>
                                )}
                              </div>
                            )}
                            {/* Text body */}
                            {msg.text && (
                              <p className="leading-relaxed whitespace-pre-wrap break-words">
                                {highlightText(msg.text)}
                              </p>
                            )}
                            {msg.timestamp && isValid(msg.timestamp) && (
                              <div className="text-xs opacity-50 mt-1 text-right">
                                {msg.timestamp.toLocaleTimeString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Scroll-to-bottom button */}
                {showScrollButton && (
                  <button
                    onClick={() => {
                      setShouldAutoScroll(true);
                      scrollToBottom("smooth");
                    }}
                    className="absolute bottom-4 right-4 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2 z-10"
                    aria-label="Scroll to bottom"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Input footer */}
              <div className="bg-card border-t border-border px-3 md:px-4 py-2 md:py-2.5 shrink-0">
                {/* Pending attachment previews */}
                {pendingAttachments.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {pendingAttachments.map((att, i) => (
                      <div
                        key={i}
                        className="relative flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1.5 text-xs max-w-[160px]"
                      >
                        {att.type === "image" && att.previewUrl ? (
                          <img
                            src={att.previewUrl}
                            alt="preview"
                            className="h-7 w-7 object-cover rounded shrink-0"
                          />
                        ) : att.type === "audio" ? (
                          <Mic className="w-3.5 h-3.5 text-primary shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                        <span className="truncate">{att.file.name}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          onClick={() => removeAttachment(i)}
                          aria-label="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recording bar */}
                {isRecording && (
                  <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      Recording{" "}
                      {Math.floor(recordingDuration / 60)
                        .toString()
                        .padStart(2, "0")}
                      :{(recordingDuration % 60).toString().padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-red-600 hover:text-red-700 transition-colors"
                      onClick={stopRecording}
                      aria-label="Stop recording"
                    >
                      <StopCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  {/* Attachment button */}
                  {humanRequested && !isRecording && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0 h-11 w-11 md:h-9 md:w-9"
                          aria-label="Attach file"
                        >
                          <Paperclip className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        side="top"
                        align="start"
                        className="w-36"
                      >
                        <DropdownMenuItem
                          onClick={() => imageInputRef.current?.click()}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Image
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => documentInputRef.current?.click()}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Document
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <Input
                    placeholder={
                      humanRequested
                        ? "Type your response as RM…"
                        : "Message (AI will respond)"
                    }
                    className="flex-1 h-11 md:h-9 text-sm"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={!humanRequested || isSending || isRecording}
                  />

                  {/* Mic button */}
                  {humanRequested && (
                    <Button
                      size="icon"
                      variant={isRecording ? "destructive" : "ghost"}
                      className="shrink-0 h-11 w-11 md:h-9 md:w-9"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isSending}
                      aria-label={
                        isRecording ? "Stop recording" : "Record voice message"
                      }
                    >
                      {isRecording ? (
                        <StopCircle className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </Button>
                  )}

                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={
                      !humanRequested ||
                      (!message.trim() && pendingAttachments.length === 0) ||
                      isSending ||
                      isRecording
                    }
                    className="shrink-0 h-11 w-11 md:h-9 md:w-9"
                  >
                    {isSending ? (
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {humanRequested ? (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 text-center leading-snug">
                    ✅ Human mode active — your responses go directly to the
                    customer.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1.5 text-center leading-snug">
                    💡 This conversation is in AI mode. To respond as RM, the
                    customer needs to request a human agent.
                  </p>
                )}

                {/* Hidden file inputs */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileSelect("image")}
                />
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={handleFileSelect("document")}
                />
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
