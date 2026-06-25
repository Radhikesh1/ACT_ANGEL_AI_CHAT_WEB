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
  Cpu,
  Mic,
  PhoneCall,
  Timer,
  User,
  Hash,
  FileText,
  PlayCircle,
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
import { useGetCallLogs, type CallLog, type CallLogMessage } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDuration(log: CallLog): number {
  if (log.duration > 0) return log.duration;
  if (log.call_status !== "in-progress" && log.started_at && log.ended_at) {
    try {
      const s = parseISO(log.started_at);
      const e = parseISO(log.ended_at);
      if (isValid(s) && isValid(e)) {
        const diff = Math.round((e.getTime() - s.getTime()) / 1000);
        if (diff > 0) return diff;
      }
    } catch { /* */ }
  }
  return 0;
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
  return `$${n.toFixed(5)}`;
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
}: {
  log: CallLog | null;
  open: boolean;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const messages = useMemo(() => parseMessages(log?.chat ?? null), [log?.chat]);
  const cb = log?.cost_breakdown ?? null;

  // Prefer audio element's actual duration over stored/computed value
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
      setIsPlaying(false);
      setAudioDuration(null);
    }
  }, [open, log?.id]);

  const togglePlayback = () => {
    if (!audioRef.current || !log?.recording_url) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying((p) => !p);
  };

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

  if (!open || !log) return null;

  const modal = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-2 sm:p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-5xl h-[98vh] sm:h-[95vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="p-3 sm:p-5 border-b border-border bg-muted/30">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full border border-primary/20">
                  <Hash className="w-2.5 h-2.5" />
                  Call Log
                </span>
              </div>
              <h2
                className="mt-1 text-sm sm:text-base font-mono font-semibold text-foreground truncate"
                title={log.session_id}
              >
                {log.session_id}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                <Bot className="w-3 h-3 shrink-0 text-primary/70" />
                <span className="truncate">{log.assistant_name || "—"}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Metadata chips — exact WEB structure */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-background border border-border px-2.5 py-2 min-w-0">
              <div className="shrink-0 w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                <User className="w-3 h-3 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-wider uppercase text-muted-foreground leading-none mb-0.5">Customer</p>
                <p className="text-xs font-mono font-medium text-foreground truncate leading-tight">{log.from_number || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-background border border-border px-2.5 py-2 min-w-0">
              <div className="shrink-0 w-6 h-6 rounded-md bg-green-500/10 flex items-center justify-center">
                <Phone className="w-3 h-3 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-wider uppercase text-muted-foreground leading-none mb-0.5">Caller</p>
                <p className="text-xs font-mono font-medium text-foreground truncate leading-tight">{log.from_number || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-background border border-border px-2.5 py-2 min-w-0">
              <div className="shrink-0 w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                <PhoneCall className="w-3 h-3 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-wider uppercase text-muted-foreground leading-none mb-0.5">Assistant Line</p>
                <p className="text-xs font-mono font-medium text-foreground truncate leading-tight">{log.to_number || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-background border border-border px-2.5 py-2 min-w-0">
              <div className="shrink-0 w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-3 h-3 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-wider uppercase text-muted-foreground leading-none mb-0.5">Created</p>
                <p className="text-xs font-medium text-foreground truncate leading-tight">{formatDateShort(log.started_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-3 sm:p-5 space-y-3 flex-1 overflow-y-auto">

          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Recording */}
            <div className="flex flex-col gap-2 rounded-xl bg-background border border-border p-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Mic className="w-3 h-3 text-primary" />
                </div>
                <span className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground">Recording</span>
              </div>
              {log.recording_url ? (
                <div className="flex items-center gap-2">
                  <audio
                    ref={audioRef}
                    src={log.recording_url}
                    onEnded={() => setIsPlaying(false)}
                    onLoadedMetadata={(e) => {
                      const d = (e.target as HTMLAudioElement).duration;
                      if (d && isFinite(d)) setAudioDuration(Math.round(d));
                    }}
                  />
                  <button
                    className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors"
                    onClick={togglePlayback}
                  >
                    <PlayCircle className={`w-6 h-6 shrink-0 ${isPlaying ? "text-green-500" : ""}`} />
                    <span className="text-xs font-medium">{isPlaying ? "Playing…" : "Play"}</span>
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> No audio
                </span>
              )}
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-2 rounded-xl bg-background border border-border p-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Timer className="w-3 h-3 text-blue-500" />
                </div>
                <span className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground">Duration</span>
              </div>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatDuration(displayDuration)}
              </span>
            </div>

            {/* Model / Tokens */}
            <div className="relative flex flex-col gap-2 rounded-xl bg-background border border-border p-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Cpu className="w-3 h-3 text-indigo-500" />
                </div>
                <span className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground">Model</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {cb ? formatModelLabel(cb.model) : "—"}
                </p>
                {cb && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {cb.tokens.input.toLocaleString()} in · {cb.tokens.output.toLocaleString()} out
                  </p>
                )}
                {!cb && log.chars_used > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {log.chars_used.toLocaleString()} chars
                  </p>
                )}
              </div>
            </div>

            {/* Cost */}
            <div className="relative flex flex-col gap-2 rounded-xl bg-background border border-border p-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <DollarSign className="w-3 h-3 text-emerald-500" />
                </div>
                <span className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground">Call Cost</span>
              </div>
              <button
                className="flex items-center gap-1.5 text-left"
                onMouseEnter={() => setShowCostBreakdown(true)}
                onMouseLeave={() => setShowCostBreakdown(false)}
              >
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {usd(log.total_cost)}
                </span>
                {costRows.length > 0 && (
                  showCostBreakdown
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
              {showCostBreakdown && costRows.length > 0 && (
                <div className="absolute top-full left-0 mt-1.5 bg-popover border border-border rounded-xl p-3 shadow-xl z-20 min-w-44">
                  <p className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">Cost Breakdown</p>
                  {costRows.map((item) => (
                    <div key={item.label} className="flex justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground text-xs">{item.label}</span>
                      <span className="font-medium text-xs font-mono">{usd(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1.5 mt-0.5 border-t border-border">
                    <span className="text-xs font-semibold">Total</span>
                    <span className="text-xs font-bold font-mono">{usd(cb?.total_usd)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Call summary / error */}
          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground">Call Summary</span>
              <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full capitalize ${statusColor(log.call_status)}`}>
                {log.call_status === "in-progress" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                {log.call_status.replace(/-/g, " ")}
              </span>
            </div>
            <div className="px-4 py-3 text-sm leading-relaxed text-foreground">
              {log.error_message ? (
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-sm">{log.error_message}</p>
                </div>
              ) : (
                <span className="text-muted-foreground italic text-sm">No summary available.</span>
              )}
            </div>
          </div>

          {/* Transcript */}
          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground">Transcript</span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">{messages.length} msgs</span>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search transcript…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 h-8 text-sm"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                </div>
                {totalMatches > 0 && (
                  <div className="flex items-center gap-0.5 bg-muted rounded-lg px-2 py-1 border border-border">
                    <span className="text-xs font-mono font-semibold text-primary whitespace-nowrap">
                      {currentMatchIndex + 1}/{totalMatches}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => setCurrentMatchIndex((i) => (i - 1 + totalMatches) % totalMatches)}>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => setCurrentMatchIndex((i) => (i + 1) % totalMatches)}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 h-[42vh] overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    No transcript recorded for this call.
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
                        className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm transition-all ${
                            isAssistant
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "bg-muted text-foreground shadow-sm border border-border"
                          } ${isHighlighted ? "ring-2 ring-primary ring-offset-2" : ""}`}
                        >
                          {highlightText(msg.content, i)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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
