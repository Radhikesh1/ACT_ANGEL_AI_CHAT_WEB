import { FileText } from "lucide-react";
import { isValid } from "date-fns";
import { escapeRegex, formatFileSize } from "@/lib/chat-utils";
import type { DisplayMessage } from "@/types/chat";

interface MessageBubbleProps {
  msg: DisplayMessage;
  isCurrentSearchMatch: boolean;
  searchQuery: string;
}

function highlightText(text: string, query: string) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
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

export function MessageBubble({
  msg,
  isCurrentSearchMatch,
  searchQuery,
}: MessageBubbleProps) {
  return (
    <div className={`flex ${msg.isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] md:max-w-[80%] px-3 md:px-4 py-2 rounded-2xl text-sm transition-all ${
          msg.isAssistant
            ? "bg-primary text-primary-foreground shadow-lg"
            : "bg-zinc-200 dark:bg-zinc-700 text-foreground shadow-sm"
        } ${isCurrentSearchMatch ? "ring-2 ring-primary ring-offset-2" : ""} ${
          msg.isPending ? "opacity-70" : ""
        }`}
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
              <audio controls src={att.url} className="h-8 max-w-[200px]" />
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
                  <span className="opacity-70">({formatFileSize(att.size)})</span>
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
              msg.mediaMetadata?.mimeType?.startsWith("audio") ? (
              <audio controls src={msg.mediaUrl} className="h-8 max-w-[200px]" />
            ) : (
              <a
                href={msg.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 underline text-xs opacity-90"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                {msg.mediaMetadata?.fileName || "Download file"}
              </a>
            )}
          </div>
        )}

        {/* Text body */}
        {msg.text && (
          <p className="leading-relaxed whitespace-pre-wrap break-words">
            {highlightText(msg.text, searchQuery)}
          </p>
        )}

        {msg.timestamp && isValid(msg.timestamp) && (
          <div className="text-xs opacity-50 mt-1 text-right">
            {msg.timestamp.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
