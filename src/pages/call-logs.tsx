import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Phone,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Bot,
  Clock,
  PhoneOff,
  DollarSign,
  Mic,
  PhoneCall,
  Timer,
  User,
  FileText,
  AlertCircle,
  MessageSquare,
  Loader2,
  X,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useGetCallLogs, usePatchCallLogDuration, type CallLog, type CallLogMessage } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDuration(log: CallLog): number {
  return log.duration > 0 ? log.duration : 0;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function parseMessages(chat: string | null): CallLogMessage[] {
  if (!chat) return [];
  try {
    const parsed = JSON.parse(chat);
    return Array.isArray(parsed)
      ? parsed.filter((m) => m.role === "user" || m.role === "assistant")
      : [];
  } catch {
    return [];
  }
}

function formatDateShort(iso: string): string {
  try {
    const d = parseISO(iso);
    if (isValid(d)) return format(d, "dd-MM-yyyy HH:mm");
  } catch { /* */ }
  return "—";
}

function formatDateTime(iso: string): string {
  try {
    const d = parseISO(iso);
    if (isValid(d)) return format(d, "dd MMM yyyy, hh:mm a");
  } catch { /* */ }
  return "—";
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatModelLabel(model: string): string {
  const labels: Record<string, string> = {
    "gpt-5-nano":  "GPT-5 Nano",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-5-mini":  "GPT-5 Mini",
    "gpt-5":       "GPT-5",
    "gpt-4o":      "GPT-4o",
    "gpt-4":       "GPT-4",
    "gpt-3.5":     "GPT-3.5",
  };
  for (const [prefix, label] of Object.entries(labels)) {
    if (model?.startsWith(prefix)) return label;
  }
  return model ?? "—";
}

function usd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n === 0) return "$0.0000";
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 0.01)  return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

function statusColor(status: string) {
  switch (status) {
    case "in-progress": return "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400";
    case "error":       return "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400";
    default:            return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
  }
}

// ── Call Detail Modal ─────────────────────────────────────────────────────────

function CallDetailModal({
  log,
  open,
  onClose,
  onDurationCorrected,
}: {
  log: CallLog | null;
  open: boolean;
  onClose: () => void;
  onDurationCorrected?: (id: string, duration: number) => void;
}) {
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const patchDuration = usePatchCallLogDuration();
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const messages = useMemo(() => parseMessages(log?.chat ?? null), [log?.chat]);
  const cb = log?.cost_breakdown ?? null;

  const displayDuration = audioDuration ?? (log ? getDuration(log) : 0);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !messages.length) return [] as CallLogMessage[];
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [searchQuery, messages]);

  const totalMatches = searchMatches.length;

  useEffect(() => { setCurrentMatchIndex(0); }, [searchQuery]);

  useEffect(() => {
    if (searchMatches.length > 0 && currentMatchIndex < searchMatches.length) {
      const idx = messages.indexOf(searchMatches[currentMatchIndex]);
      messageRefs.current[`msg-${idx}`]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentMatchIndex, searchMatches, messages]);

  useEffect(() => {
    if (open && log) {
      setSearchQuery("");
      setCurrentMatchIndex(0);
      setAudioDuration(null);
    }
  }, [open, log?.id]);

  function highlightText(text: string, i: number) {
    if (!searchQuery.trim()) return <>{text}</>;
    const q = searchQuery.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return <>{text}</>;
    const isCurrentMatch =
      searchMatches[currentMatchIndex] &&
      messages.indexOf(searchMatches[currentMatchIndex]) === i;
    const cls = isCurrentMatch
      ? "bg-yellow-400 text-black font-medium px-0.5 rounded"
      : "bg-yellow-200 text-black px-0.5 rounded";
    return (
      <>
        {text.slice(0, idx)}
        <span className={cls}>{text.slice(idx, idx + searchQuery.length)}</span>
        {text.slice(idx + searchQuery.length)}
      </>
    );
  }

  const costRows = useMemo(() => {
    if (!cb) return [];
    const rows: { label: string; value: number }[] = [
      { label: "LLM", value: cb.llm_usd },
      { label: "STT", value: cb.stt_usd },
      { label: "Phone", value: cb.phone_usd },
    ];
    if (cb.platform_usd > 0) rows.push({ label: "Platform", value: cb.platform_usd });
    return rows;
  }, [cb]);

  const shortId = log?.session_id
    ? `···${log.session_id.replace(/-/g, "").slice(-8)}`
    : "—";

  if (!open || !log) return null;

  const modal = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[96vh] flex flex-col overflow-hidden border border-border/40">

        {/* ── Header ── */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2
                className="text-sm sm:text-[15px] font-bold text-primary leading-snug break-all"
                title={log.session_id}
              >
                Call ID: {log.session_id}
                {log.assistant_name && (
                  <span className="text-foreground font-normal"> / {log.assistant_name}</span>
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  <User className="w-3 h-3" />
                  <span>Customer Phone Number:</span>
                  <span className="font-mono text-foreground">{log.from_number || "—"}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  <Phone className="w-3 h-3" />
                  <span>Assistant Phone Number:</span>
                  <span className="font-mono text-foreground">{log.to_number || "—"}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  <Clock className="w-3 h-3" />
                  <span>Created At:</span>
                  <span className="text-foreground">{formatDateShort(log.started_at)}</span>
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Metrics grid ── */}
          <div className="px-5 sm:px-6 py-4 border-b border-border grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3.5">

            {/* Recording */}
            <div className="flex items-center gap-3 min-w-0">
              <Mic className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">Recording:</span>
              {log.recording_url ? (
                <audio
                  controls
                  src={log.recording_url}
                  className="h-7 flex-1 min-w-0"
                  onLoadedMetadata={(e) => {
                    const d = (e.target as HTMLAudioElement).duration;
                    if (!d || !isFinite(d)) return;
                    const secs = Math.round(d);
                    setAudioDuration(secs);
                    if (log && secs !== log.duration) {
                      patchDuration.mutate(
                        { id: log.id, duration: secs },
                        { onSuccess: () => onDurationCorrected?.(log.id, secs) },
                      );
                    }
                  }}
                />
              ) : (
                <span className="text-sm text-muted-foreground">No recording</span>
              )}
            </div>

            {/* Duration */}
            <div className="flex items-center gap-3">
              <Timer className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-foreground">Call Duration:</span>
              <span className="text-sm text-foreground tabular-nums font-medium">{formatDuration(displayDuration)}</span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <PhoneCall className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-foreground">Status:</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusColor(log.call_status)}`}>
                {log.call_status === "in-progress" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                )}
                {log.call_status.replace(/-/g, " ")}
              </span>
            </div>

            {/* Cost */}
            <div className="relative flex items-center gap-3">
              <DollarSign className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-sm font-semibold text-orange-500">Call Cost:</span>
              <button
                className="flex items-center gap-1 text-sm font-semibold text-orange-500 hover:text-orange-400 transition-colors"
                onMouseEnter={() => setShowCostBreakdown(true)}
                onMouseLeave={() => setShowCostBreakdown(false)}
              >
                <span className="font-mono">{usd(log.total_cost)}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showCostBreakdown && (
                <div className="absolute top-full left-0 mt-1.5 bg-popover border border-border rounded-xl p-3 shadow-xl z-20 min-w-52">
                  <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Cost Breakdown</p>
                  {costRows.map((item) => (
                    <div key={item.label} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground text-xs">{item.label}</span>
                      <span className="font-mono font-medium text-xs">{usd(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1.5 mt-0.5 border-t border-border">
                    <span className="text-xs font-bold">Total</span>
                    <span className="text-xs font-bold font-mono">{usd(log.total_cost)}</span>
                  </div>
                  {(cb || log.chars_used > 0) && (
                    <div className="mt-3 pt-2.5 border-t border-border/50 space-y-1.5">
                      <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">Usage</p>
                      {cb ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">Tokens in</span>
                            <span className="font-mono text-xs">{cb.tokens.input.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">Tokens out</span>
                            <span className="font-mono text-xs">{cb.tokens.output.toLocaleString()}</span>
                          </div>
                          {cb.model && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-xs">Model</span>
                              <span className="text-xs">{formatModelLabel(cb.model)}</span>
                            </div>
                          )}
                        </>
                      ) : log.chars_used > 0 ? (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-xs">Chars used</span>
                          <span className="font-mono text-xs">{log.chars_used.toLocaleString()}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Call Summary ── */}
          <div className="px-5 sm:px-6 py-3.5 border-b border-border">
            <div className="flex items-start gap-2.5">
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${log.error_message ? "text-destructive" : "text-muted-foreground"}`} />
              <p className="text-sm leading-relaxed">
                <span className="font-semibold text-foreground">Call Summary: </span>
                {log.error_message ? (
                  <span className="text-destructive">{log.error_message}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {messages.length > 0
                      ? `${messages.length} messages exchanged during this call.`
                      : "No transcript recorded for this call."}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* ── Transcript ── */}
          <div className="px-5 sm:px-6 pt-4 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transcript</span>
              <span className="ml-auto text-xs font-mono text-muted-foreground">{messages.length} messages</span>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search transcript…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-sm bg-muted/30"
                />
              </div>
              {totalMatches > 0 && (
                <div className="flex items-center gap-0.5 bg-muted rounded-lg px-2 py-1 border border-border">
                  <span className="text-xs font-mono font-semibold text-primary whitespace-nowrap">
                    {currentMatchIndex + 1}/{totalMatches}
                  </span>
                  <Button size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => setCurrentMatchIndex((i) => (i - 1 + totalMatches) % totalMatches)}>
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => setCurrentMatchIndex((i) => (i + 1) % totalMatches)}>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No transcript recorded for this call.</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isAssistant = msg.role === "assistant";
                  const isHighlighted =
                    searchMatches[currentMatchIndex] &&
                    messages.indexOf(searchMatches[currentMatchIndex]) === i;
                  return (
                    <div
                      key={i}
                      ref={(el) => { messageRefs.current[`msg-${i}`] = el; }}
                      className={`flex gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}
                    >
                      {isAssistant && (
                        <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                          <Bot className="w-3.5 h-3.5 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isAssistant
                            ? "bg-primary text-primary-foreground rounded-tl-sm"
                            : "bg-muted text-foreground border border-border rounded-tr-sm"
                        } ${isHighlighted ? "ring-2 ring-yellow-400 ring-offset-1" : ""}`}
                      >
                        {highlightText(msg.content, i)}
                      </div>
                      {!isAssistant && (
                        <div className="shrink-0 w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center mt-1">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Sort types ────────────────────────────────────────────────────────────────

type SortField = "date" | "from_number" | "assistant_name" | "duration" | "call_status" | "total_cost";
type SortOrder = "asc" | "desc";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CallLogsPage() {
  const queryClient = useQueryClient();

  const hasActiveCalls = (logs: { call_status: string }[]) =>
    logs.some((l) => l.call_status === "in-progress");

  const { data: logs = [], isLoading, isFetching, refetch } = useGetCallLogs({
    query: {
      refetchInterval: (query) =>
        hasActiveCalls(
          Array.isArray(query.state.data)
            ? (query.state.data as { call_status: string }[])
            : [],
        )
          ? 5000
          : false,
    },
  });

  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }, [sortField]);

  const filteredLogs = useMemo(() => {
    const q = listSearch.toLowerCase().trim();
    const base = q
      ? logs.filter(
          (l) =>
            l.from_number.includes(q) ||
            l.to_number.includes(q) ||
            (l.assistant_name || "").toLowerCase().includes(q) ||
            l.call_status.toLowerCase().includes(q),
        )
      : logs;

    return [...base].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortField) {
        case "date":           av = a.started_at ?? ""; bv = b.started_at ?? ""; break;
        case "from_number":    av = a.from_number ?? ""; bv = b.from_number ?? ""; break;
        case "assistant_name": av = (a.assistant_name ?? "").toLowerCase(); bv = (b.assistant_name ?? "").toLowerCase(); break;
        case "duration":       av = getDuration(a); bv = getDuration(b); break;
        case "call_status":    av = a.call_status ?? ""; bv = b.call_status ?? ""; break;
        case "total_cost":     av = a.total_cost ?? 0; bv = b.total_cost ?? 0; break;
        default: return 0;
      }
      if (av < bv) return sortOrder === "asc" ? -1 : 1;
      if (av > bv) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [logs, listSearch, sortField, sortOrder]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 inline-block" />;
    return sortOrder === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3 inline-block" />
      : <ArrowDown className="ml-1 h-3 w-3 inline-block" />;
  }

  const headers: { field: SortField; label: string }[] = [
    { field: "date",           label: "Date" },
    { field: "from_number",    label: "Caller" },
    { field: "assistant_name", label: "Assistant" },
    { field: "duration",       label: "Duration" },
    { field: "call_status",    label: "Status" },
    { field: "total_cost",     label: "Cost" },
  ];

  return (
    <AdminLayout title="Call Logs">
      <div className="space-y-4">
        <CallDetailModal
          log={selectedLog}
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          onDurationCorrected={() => queryClient.invalidateQueries({ queryKey: ["call-logs"] })}
        />

        <Card>
          <CardContent className="p-4 md:p-6">
            {/* Header row */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-semibold">Call Logs</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by number or assistant…"
                    className="pl-9 h-9 text-sm w-56 md:w-64"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => { queryClient.invalidateQueries({ queryKey: ["call-logs"] }); refetch(); }}
                  disabled={isFetching}
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                </Button>
                <Badge variant="secondary">{logs.length}</Badge>
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {logs.length === 0 ? "No call logs yet." : "No results found."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm border-b">
                      {headers.map(({ field, label }) => (
                        <th
                          key={field}
                          className="pb-3 font-medium text-primary cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSort(field)}
                        >
                          {label}
                          <SortIcon field={field} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const isActive = log.call_status === "in-progress";
                      const isError  = log.call_status === "error";
                      return (
                        <tr
                          key={log.id}
                          className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedLog(log)}
                        >
                          <td className="py-4 text-sm text-muted-foreground whitespace-nowrap">
                            {formatDateShort(log.started_at)}
                          </td>
                          <td className="py-4 text-sm font-mono font-medium">
                            {log.from_number || "—"}
                          </td>
                          <td className="py-4 text-sm text-muted-foreground">
                            {log.assistant_name || "—"}
                          </td>
                          <td className="py-4 text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3 shrink-0" />
                              {formatDuration(getDuration(log))}
                            </span>
                          </td>
                          <td className="py-4 text-sm">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusColor(log.call_status)}`}>
                              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                              {isError && <PhoneOff className="w-2.5 h-2.5" />}
                              {log.call_status.replace(/-/g, " ")}
                            </span>
                          </td>
                          <td className="py-4 text-sm font-mono">
                            {log.total_cost != null ? usd(log.total_cost) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
