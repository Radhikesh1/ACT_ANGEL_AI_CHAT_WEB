import { useState, useEffect } from "react";
import { Building2, LogOut, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getUrlParams } from "@/lib/chat-utils";
import type { Organisation } from "@/types/chat";

export function OrgPicker({
  onSelect,
  onLogout,
}: {
  onSelect: (org: Organisation) => void;
  onLogout: () => void;
}) {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobileEmbed = !!getUrlParams().mobile;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/organizations", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          window.location.href = "/login";
          return;
        }
        if (!r.ok) throw new Error(`Server error (HTTP ${r.status})`);

        const text = await r.text();
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Unexpected response from server. Please try again.");
        }

        const list: Organisation[] = Array.isArray(data)
          ? data
          : ((data as any).items ??
            (data as any).data ??
            (data as any).organizations ??
            []);
        setOrgs(list);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Failed to load organisations",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      <header
        className={`h-14 md:h-16 bg-card border-b border-border shadow-sm flex items-center justify-between px-4 md:px-6 shrink-0 ${isMobileEmbed ? "hidden" : ""}`}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <Logo className="w-6 h-6 md:w-7 md:h-7 object-contain" />
          <span className="font-bold text-primary font-['Plus_Jakarta_Sans'] text-base md:text-lg tracking-tight">
            Chat Angel AI
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Log Out</span>
        </Button>
      </header>

      <div className="flex-1 flex items-start md:items-center justify-center p-4 md:p-6 overflow-y-auto">
        <div className="w-full max-w-lg pt-4 md:pt-0">
          <div className="mb-6 md:mb-8">
            <h1 className="text-xl md:text-2xl font-bold font-['Plus_Jakarta_Sans'] text-foreground mb-1">
              Select Organisation
            </h1>
            <p className="text-muted-foreground text-sm">
              You are logged in as Super Admin. Choose which organisation to
              manage.
            </p>
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium mb-1">Could not load organisations</p>
              <p className="text-xs opacity-80">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && orgs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No organisations found.
            </div>
          )}

          {!loading && !error && orgs.length > 0 && (
            <div className="space-y-3">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => onSelect(org)}
                  className="w-full p-4 border border-border rounded-xl text-left hover:border-primary hover:bg-primary/10 active:bg-primary/15 transition-all group flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground font-['Plus_Jakarta_Sans']">
                      {org.name}
                    </div>
                    {org.slug && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {org.slug}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
