import { Link, useLocation } from "wouter";
import { Bot, Phone, LogOut, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout } from "@/lib/api";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

const NAV = [
  { href: "/assistants", label: "Assistants", icon: Bot },
  { href: "/numbers", label: "Phone Numbers", icon: Phone },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const [location] = useLocation();
  const logout = useLogout({
    mutation: {
      onSuccess: () => { window.location.href = "/login"; },
      onError: () => { toast.error("Logout failed"); },
    },
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r bg-card flex flex-col">
        <div className="h-14 flex items-center px-4 border-b">
          <Logo className="h-7 w-auto" />
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          <Link
            href="/chat"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Chat
          </Link>

          <div className="pt-2 pb-1 px-3">
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
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {title && (
          <header className="h-14 border-b flex items-center px-6 flex-shrink-0">
            <h1 className="text-lg font-semibold">{title}</h1>
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
