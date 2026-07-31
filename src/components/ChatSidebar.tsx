import { Search, Headphones } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, isValid } from "date-fns";
import { getInitials } from "@/lib/utils";
import { displayName, lastMsg } from "@/lib/chat-utils";
import type { ActChatItem } from "@/types/chat";

interface ChatSidebarProps {
  showConvo: boolean;
  mobile: string | undefined;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  isLoading: boolean;
  chats: ActChatItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  totalCount: number;
}

export function ChatSidebar({
  showConvo,
  mobile,
  listSearch,
  onListSearchChange,
  isLoading,
  chats,
  selectedId,
  onSelect,
  totalCount,
}: ChatSidebarProps) {
  return (
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
            className="pl-9 bg-background border-input rounded-lg h-9 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
            value={listSearch}
            onChange={(e) => onListSearchChange(e.target.value)}
            disabled={!!mobile}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
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
        ) : chats.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No conversations found.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {chats.map((log) => {
              const name = displayName(log);
              const { text, time } = lastMsg(log);
              return (
                <button
                  key={log.id}
                  onClick={() => onSelect(log.id)}
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
  );
}
