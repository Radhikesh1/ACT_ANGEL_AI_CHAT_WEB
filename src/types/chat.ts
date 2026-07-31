export interface AttachmentData {
  url: string;
  type: "image" | "document" | "audio";
  filename: string;
  size: number;
  duration?: number;
  mimeType?: string;
  caption?: string;
}

export interface PendingAttachment {
  file: File;
  previewUrl?: string;
  type: "image" | "document" | "audio";
}

export interface ActMessage {
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

export interface ActChatItem {
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

export interface DisplayMessage {
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

export interface Organisation {
  id: string;
  name: string;
  slug?: string;
  logo?: string;
}
