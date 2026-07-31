import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLogin, useGetMe } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/Logo";

function redirectToChat() {
  // Forward all URL params (contact, mobile, etc.) to /chat.
  // Full page reload clears TanStack Query cache — prevents stale-auth redirect loop.
  const params = window.location.search;
  window.location.href = params ? `/chat${params}` : "/chat";
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const hasRedirected = useRef(false);

  // If user is already authenticated, redirect straight to /chat.
  // Use window.location.href (full reload) so there is no stale TanStack Query
  // cache that could cause a /login ↔ /chat redirect loop.
  const { data: existingUser } = useGetMe();
  useEffect(() => {
    if (existingUser && !hasRedirected.current) {
      hasRedirected.current = true;
      redirectToChat();
    }
  }, [existingUser]);

  const { mutate: login, isPending } = useLogin({
    mutation: {
      onSuccess: () => redirectToChat(),
      onError: (error) => {
        toast.error(
          (error.data as any)?.message ||
            "Login failed. Please check your credentials.",
        );
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please enter both username and password");
      return;
    }
    login({ data: { username, password } });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 font-sans">
      <Card className="w-full max-w-md bg-card shadow-sm border-none rounded-xl">
        <CardHeader className="space-y-4 pb-6 pt-8 text-center flex flex-col items-center">
          <Logo className="w-20 h-16 md:w-24 md:h-20 mb-2 md:mb-3" />
          <h1 className="text-lg md:text-xl font-semibold text-primary">
            Chat Angel AI
          </h1>
          <h2 className="text-xl md:text-2xl font-bold text-primary mt-1 md:mt-2">
            Log in
          </h2>
        </CardHeader>
        <CardContent className="pb-8 px-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="border-input rounded-lg h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-input rounded-lg pr-10 h-11"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-11 text-base font-medium mt-2"
              disabled={isPending}
            >
              {isPending ? "Logging in..." : "Log In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
