import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import {
  ORG_STORAGE_KEY,
  getUrlParams,
  displayName,
  msgContent,
  msgTime,
  isUserMsg,
  isHumanAgent,
  loadStoredOrg,
} from "@/lib/chat-utils";
import type {
  ActChatItem,
  DisplayMessage,
  AttachmentData,
  PendingAttachment,
  Organisation,
} from "@/types/chat";

export function useChatPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [listSearch, setListSearch] = useState(
    () => getUrlParams().mobile ?? "",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<DisplayMessage[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(
    loadStoredOrg,
  );

  // DOM refs returned to the component for attachment to elements
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Internal refs not exposed
  const autoSelectedRef = useRef(false);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevMessageCountRef = useRef(0);

  const { contactId, mobile } = useMemo(() => getUrlParams(), []);

  // ── Auth ────────────────────────────────────────────────────────────────────
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

  // ── Notifications ────────────────────────────────────────────────────────────
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
    notificationsList.filter((n) => !n.read).forEach((n) => markReadMutation(n.id));
  const dismissNotif = (id: string) => deleteNotificationMutation(id);

  // ── Org / user derived values ────────────────────────────────────────────────
  const isSuperAdmin =
    !!user &&
    ((user as any).role === "SAD" || (user as any).role === "SUPER_ADMIN");
  const userOrgId = user
    ? ((user as any).organizationId ?? (user as any).orgId ?? null)
    : null;
  const orgId: string | null = userOrgId ?? selectedOrg?.id ?? null;
  const needsOrgSelection = !!user && !!isSuperAdmin && !userOrgId && !selectedOrg;

  const displayUserName: string =
    (user as any)?.displayName || (user as any)?.name || (user as any)?.username || "";
  const orgDisplayName: string =
    selectedOrg?.name ||
    (user as any)?.organizationName ||
    (user as any)?.orgName ||
    (user as any)?.organization?.name ||
    "";

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

  // ── Chat logs query ──────────────────────────────────────────────────────────
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

  const filteredLogs = useMemo(() => {
    const term = listSearch.trim().toLowerCase();
    if (!term) return chatLogs;
    const termDigits = term.replace(/\D/g, "");
    return chatLogs.filter((log) => {
      if (displayName(log).toLowerCase().includes(term)) return true;
      if (termDigits && log.recipientNumber) {
        return log.recipientNumber.replace(/\D/g, "").includes(termDigits);
      }
      return false;
    });
  }, [chatLogs, listSearch]);

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

  const humanRequested = !!(selectedChat as any)?.humanRequested;

  // ── Messages ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setPendingMessages([]);
    setShouldAutoScroll(true);
    setShowScrollButton(false);
    setTranscriptSearch("");
    setMessage("");
    isUserScrollingRef.current = false;
  }, [selectedId]);

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
        const agentLabel = msg.agentName ?? (isHumanAgent(msg) ? "RM Agent" : null);
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

  const displayMessages: DisplayMessage[] = useMemo(() => {
    const serverTexts = new Set(serverDisplayMessages.map((m) => m.text));
    const uniquePending = pendingMessages.filter((p) => !serverTexts.has(p.text));
    return [...serverDisplayMessages, ...uniquePending];
  }, [serverDisplayMessages, pendingMessages]);

  // ── Scroll ───────────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
      }
    });
  }, []);

  useEffect(() => {
    const count = displayMessages.length;
    if (count > prevMessageCountRef.current && shouldAutoScroll) {
      scrollToBottom("smooth");
    }
    prevMessageCountRef.current = count;
  }, [displayMessages.length, shouldAutoScroll, scrollToBottom]);

  useEffect(() => {
    scrollToBottom("auto");
  }, [selectedId, scrollToBottom]);

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

  // ── Transcript search ────────────────────────────────────────────────────────
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

  // ── File upload ──────────────────────────────────────────────────────────────
  const uploadFile = async (file: File): Promise<AttachmentData> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
    return data.data as AttachmentData;
  };

  const handleFileSelect =
    (type: "image" | "document") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const previewUrl = type === "image" ? URL.createObjectURL(file) : undefined;
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

  // ── Recording ────────────────────────────────────────────────────────────────
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

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!humanRequested || isSending) return;
    if (!message.trim() && pendingAttachments.length === 0) return;

    const msgText = message.trim();
    setIsSending(true);
    setMessage("");
    const attsCopy = [...pendingAttachments];
    setPendingAttachments([]);

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
        setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
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

  return {
    // navigation
    setLocation,
    // user / auth
    user,
    logout,
    displayUserName,
    // org
    orgDisplayName,
    isSuperAdmin,
    selectedOrg,
    needsOrgSelection,
    handleOrgSelect,
    handleSwitchOrg,
    // notifications
    notificationsList,
    unreadCount,
    showNotifications,
    setShowNotifications,
    markNotifRead,
    markAllRead,
    dismissNotif,
    // chat list
    mobile,
    listSearch,
    setListSearch,
    isLoadingLogs,
    filteredLogs,
    totalCount,
    selectedId,
    setSelectedId,
    // conversation
    selectedChat,
    humanRequested,
    displayMessages,
    // transcript search
    transcriptSearch,
    setTranscriptSearch,
    currentMatchIndex,
    searchMatches,
    totalMatches,
    goToNextMatch,
    goToPrevMatch,
    // scroll
    showScrollButton,
    setShouldAutoScroll,
    scrollToBottom,
    // message input
    message,
    setMessage,
    isSending,
    // attachments
    pendingAttachments,
    removeAttachment,
    handleFileSelect,
    // recording
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    // send
    sendMessage,
    // DOM refs (attached to elements in JSX)
    messagesEndRef,
    chatContainerRef,
    messageRefs,
    imageInputRef,
    documentInputRef,
  };
}
