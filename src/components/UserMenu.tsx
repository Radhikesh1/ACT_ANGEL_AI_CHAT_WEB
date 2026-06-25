import { useLocation } from "wouter";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useGetMe, useLogout } from "@/lib/api";
import { toast } from "sonner";

function getInitials(name: string): string {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

export function UserMenu() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();

  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        window.location.href = "/login";
      },
      onError: () => {
        toast.error("Logout failed");
      },
    },
  });

  if (!user) return null;

  const displayName =
    (user as any).displayName ||
    (user as any).name ||
    (user as any).username ||
    "User";
  const email = (user as any).email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-9 w-9 rounded-full border-2 border-border hover:border-primary hover:ring-2 hover:ring-primary/20 transition-colors overflow-hidden shrink-0"
          aria-label="User menu"
        >
          <Avatar className="h-full w-full">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold rounded-full">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          {email && (
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation("/profile")}>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout.mutate()}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
