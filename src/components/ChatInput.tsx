import { type RefObject, type ChangeEvent } from "react";
import { FileText, Mic, Paperclip, Send, StopCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PendingAttachment } from "@/types/chat";

interface ChatInputProps {
  humanRequested: boolean;
  pendingAttachments: PendingAttachment[];
  onRemoveAttachment: (i: number) => void;
  isRecording: boolean;
  recordingDuration: number;
  onStopRecording: () => void;
  onStartRecording: () => void;
  message: string;
  onMessageChange: (v: string) => void;
  onSend: () => void;
  isSending: boolean;
  imageInputRef: RefObject<HTMLInputElement | null>;
  documentInputRef: RefObject<HTMLInputElement | null>;
  onImageFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onDocumentFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function ChatInput({
  humanRequested,
  pendingAttachments,
  onRemoveAttachment,
  isRecording,
  recordingDuration,
  onStopRecording,
  onStartRecording,
  message,
  onMessageChange,
  onSend,
  isSending,
  imageInputRef,
  documentInputRef,
  onImageFileSelect,
  onDocumentFileSelect,
}: ChatInputProps) {
  return (
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
                onClick={() => onRemoveAttachment(i)}
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
            {Math.floor(recordingDuration / 60).toString().padStart(2, "0")}:
            {(recordingDuration % 60).toString().padStart(2, "0")}
          </span>
          <button
            type="button"
            className="ml-auto text-red-600 hover:text-red-700 transition-colors"
            onClick={onStopRecording}
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
            <DropdownMenuContent side="top" align="start" className="w-36">
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
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
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
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
            onClick={isRecording ? onStopRecording : onStartRecording}
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
          onClick={onSend}
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
          ✅ Human mode active — your responses go directly to the customer.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1.5 text-center leading-snug">
          💡 This conversation is in AI mode. To respond as RM, the customer
          needs to request a human agent.
        </p>
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={onImageFileSelect}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={onDocumentFileSelect}
      />
    </div>
  );
}
