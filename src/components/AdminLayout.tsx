import { Link, useLocation } from "wouter";
import { Bot, Phone, LayoutDashboard, Sun, Moon, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme-context";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { UserMenu } from "@/components/UserMenu";

const NAV = [
  { href: "/assistants", label: "Assistants", icon: Bot },
  { href: "/numbers", label: "Phone Numbers", icon: Phone },
  { href: "/call-logs", label: "Call Logs", icon: PhoneCall },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  noPadding?: boolean;
  headerLeft?: React.ReactNode;
}

export function AdminLayout({ children, title, noPadding, headerLeft }: AdminLayoutProps) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r bg-sidebar flex flex-col">

        {/* Logo + app name */}
        <div className="h-16 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
          <Logo className="h-10 w-auto flex-shrink-0" />
          <span
            className="text-sm font-semibold truncate"
            style={{ fontFamily: "var(--font-display)", color: "hsl(var(--sidebar-foreground))" }}
          >
            Act Angel AI
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          <Link
            href="/chat"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              location.startsWith("/chat")
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
            Chat
          </Link>

          <div className="pt-3 pb-1 px-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Management
            </span>
          </div>

          {NAV.map(({ href, label, icon: Icon }) => {
            const active = location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer: theme toggle */}
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Moon className="h-4 w-4 flex-shrink-0" />
            )}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Persistent header with notifications + profile */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {title && <h1 className="text-base font-semibold">{title}</h1>}
            {headerLeft}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        {noPadding ? (
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        )}
      </main>
    </div>
  );
}
