import { parseISO, isValid, fromUnixTime } from "date-fns";
import type { ActMessage, ActChatItem } from "@/types/chat";

export const ORG_STORAGE_KEY = "actangel_selected_org";

export function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    contactId: p.get("contact") ?? undefined,
    mobile: p.get("mobile") ?? undefined,
  };
}

export function displayName(item: ActChatItem): string {
  const name = item.recipientName ?? "";
  const phone = item.recipientNumber ?? "";
  if (name && name !== phone) return name;
  return phone || "Unknown";
}

export function msgContent(msg: ActMessage): string {
  return msg.text ?? msg.content ?? msg.body ?? "";
}

export function msgTime(msg: ActMessage): Date | null {
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

export function isUserMsg(msg: ActMessage, recipientNumber?: string): boolean {
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

export function isHumanAgent(msg: ActMessage): boolean {
  return msg.role === "human";
}

export function lastMsg(item: ActChatItem): { text: string; time: Date | null } {
  const msgs = item.messages ?? [];
  if (msgs.length === 0) return { text: "No messages yet", time: null };
  const last = msgs[msgs.length - 1];
  return { text: msgContent(last) || "No messages yet", time: msgTime(last) };
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function loadStoredOrg(): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem(ORG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
