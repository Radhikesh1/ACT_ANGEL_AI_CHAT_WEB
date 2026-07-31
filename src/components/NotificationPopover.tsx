import { Bell, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Notification } from "@/lib/api";

interface NotificationPopoverProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
}

export function NotificationPopover({
  open,
  onOpenChange,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
}: NotificationPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-72">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              You have no new notifications.
            </div>
          ) : (
            notifications.map((notif) => (
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
                        onClick={() => onMarkRead(notif.id)}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => onDismiss(notif.id)}
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
        {notifications.some((n) => !n.read) && (
          <div className="px-4 py-2.5 border-t border-border">
            <button
              onClick={onMarkAllRead}
              className="w-full text-xs text-primary hover:underline font-medium"
            >
              Mark All as Read
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
