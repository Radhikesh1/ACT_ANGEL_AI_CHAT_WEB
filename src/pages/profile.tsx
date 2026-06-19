import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Eye, EyeOff, KeyRound, Bell, Moon, Sun, ShieldCheck, Building2, Save } from "lucide-react";
import { useGetMe, useChangePassword, useUpdateProfile, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme-context";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

function getInitials(name: string): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    SAD: "Super Admin", SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin", AGENT: "Agent", RM: "Relationship Manager",
  };
  return map[role] ?? role;
}

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);

  // Editable profile fields
  const [displayName, setDisplayName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("");
  const [languages, setLanguages] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // Populate form from user data
  useEffect(() => {
    if (!user) return;
    const u = user as any;
    setDisplayName(u.displayName || u.name || "");
    setContactNumber(u.contactNumber || u.phone || "");
    setBirthDate(u.birthDate ? u.birthDate.substring(0, 10) : "");
    setCountry(u.country || "");
    setLanguages(u.languages || "");
    setAddress(u.address || "");
    setEmergencyContact(u.emergencyContact || "");
  }, [user]);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { mutate: updateProfile, isPending: isSavingProfile } = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        toast.success("Profile updated successfully.");
        queryClient.invalidateQueries({ queryKey: ["me"] });
      },
      onError: (error) => {
        const msg = (error instanceof ApiError && (error.data as any)?.message) || "Failed to update profile.";
        toast.error(msg);
      },
    },
  });

  const { mutate: changePassword, isPending: isChangingPassword } = useChangePassword({
    mutation: {
      onSuccess: () => {
        toast.success("Password updated successfully.");
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      },
      onError: (error) => {
        const msg = (error instanceof ApiError && (error.data as any)?.message) || "Failed to update password.";
        toast.error(msg);
      },
    },
  });

  const handleSaveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateProfile({
      displayName: displayName || null,
      contactNumber: contactNumber || null,
      birthDate: birthDate || null,
      country: country || null,
      languages: languages || null,
      address: address || null,
      emergencyContact: emergencyContact || null,
    });
  };

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields."); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match."); return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters."); return;
    }
    changePassword({ currentPassword, newPassword });
  };

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const u = user as any;
  const resolvedName = u.displayName || u.name || u.username || "User";
  const username = u.username || "";
  const email = u.email || "";
  const role = u.role || "";
  const orgName = u.organizationName || u.orgName || u.organization?.name || "";

  return (
    <div className="h-screen flex flex-col bg-background font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-card border-b border-border flex items-center px-4 md:px-6 gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="rounded-lg border border-border h-9 w-9 hover:bg-primary/10 hover:text-primary" onClick={() => setLocation("/chat")} aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Logo className="w-6 h-6 object-contain shrink-0" />
        <span className="font-bold text-primary font-['Plus_Jakarta_Sans'] text-base tracking-tight hidden sm:block">
          Act Angel AI
        </span>
        <span className="text-muted-foreground text-sm hidden sm:block">/ Profile</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto px-3 md:px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* ── Left: Profile Form ── */}
          <div className="md:col-span-2">
            <Card className="border-none shadow-sm">
              <CardContent className="p-4">

                {/* Avatar + identity */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4">
                  <Avatar className="h-16 w-16 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                      {getInitials(resolvedName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center sm:text-left">
                    <h2 className="text-xl md:text-2xl font-bold font-['Plus_Jakarta_Sans'] text-primary">
                      {resolvedName}
                    </h2>
                    {username && (
                      <p className="text-sm text-muted-foreground mt-0.5">@{username}</p>
                    )}
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-3">
                      {role && (
                        <Badge className="gap-1 bg-primary/10 text-primary border-0 hover:bg-primary/20">
                          <ShieldCheck className="w-3 h-3" />
                          {roleLabel(role)}
                        </Badge>
                      )}
                      {orgName && (
                        <Badge variant="secondary" className="gap-1">
                          <Building2 className="w-3 h-3" />
                          {orgName}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator className="mb-4" />

                {/* Read-only fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {username && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Username</Label>
                      <Input value={username} disabled className="h-10 bg-muted/50 text-sm" />
                    </div>
                  )}
                  {email && (
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs text-muted-foreground uppercase tracking-wider">
                        Business Email
                      </Label>
                      <Input id="email" value={email} disabled className="h-10 bg-muted/50 text-sm" />
                    </div>
                  )}
                </div>

                <Separator className="mb-4" />

                {/* Editable fields */}
                <form onSubmit={handleSaveProfile}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="displayName" className="text-xs text-muted-foreground uppercase tracking-wider">
                        Display Name
                      </Label>
                      <Input
                        id="displayName"
                        placeholder="Your display name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contactNumber" className="text-xs text-muted-foreground uppercase tracking-wider">
                        Contact Number
                      </Label>
                      <Input
                        id="contactNumber"
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="birthDate" className="text-xs text-muted-foreground uppercase tracking-wider">
                        Birth Date
                      </Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="country" className="text-xs text-muted-foreground uppercase tracking-wider">
                        Country
                      </Label>
                      <Input
                        id="country"
                        placeholder="e.g., United States"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="languages" className="text-xs text-muted-foreground uppercase tracking-wider">
                        Languages Spoken
                      </Label>
                      <Input
                        id="languages"
                        placeholder="e.g., English, Spanish, French"
                        value={languages}
                        onChange={(e) => setLanguages(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="emergencyContact" className="text-xs text-muted-foreground uppercase tracking-wider">
                        Emergency Contact
                      </Label>
                      <Input
                        id="emergencyContact"
                        placeholder="Name and phone number"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="address" className="text-xs text-muted-foreground uppercase tracking-wider">
                        Address
                      </Label>
                      <Input
                        id="address"
                        placeholder="Your address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full sm:w-auto h-10 px-6 rounded-lg text-sm font-medium gap-2"
                    disabled={isSavingProfile}
                  >
                    <Save className="w-4 h-4" />
                    {isSavingProfile ? "Saving…" : "Save Profile"}
                  </Button>
                </form>

              </CardContent>
            </Card>
          </div>

          {/* ── Right: Settings ── */}
          <div className="space-y-3">

            {/* Change Password */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold font-['Plus_Jakarta_Sans'] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  Change Password
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <form onSubmit={handleChangePassword} className="space-y-3">
                  {[
                    { id: "cur-pw", label: "Current Password", value: currentPassword, set: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(!showCurrent), complete: "current-password" },
                    { id: "new-pw", label: "New Password", value: newPassword, set: setNewPassword, show: showNew, toggle: () => setShowNew(!showNew), complete: "new-password", placeholder: "Min. 6 characters" },
                    { id: "conf-pw", label: "Confirm New Password", value: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(!showConfirm), complete: "new-password" },
                  ].map((f) => (
                    <div key={f.id} className="space-y-1.5">
                      <Label htmlFor={f.id} className="text-xs">{f.label}</Label>
                      <div className="relative">
                        <Input
                          id={f.id}
                          type={f.show ? "text" : "password"}
                          placeholder={f.placeholder || f.label}
                          value={f.value}
                          onChange={(e) => f.set(e.target.value)}
                          className="pr-9 h-10 rounded-lg text-sm"
                          autoComplete={f.complete}
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={f.toggle}
                        >
                          {f.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <Button type="submit" className="w-full h-10 rounded-lg text-sm font-medium" disabled={isChangingPassword}>
                    {isChangingPassword ? "Updating…" : "Update Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="border-none shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">Notifications</span>
                  </div>
                  <Switch checked={notifications} onCheckedChange={setNotifications} aria-label="Toggle notifications" />
                </div>
              </CardContent>
            </Card>

            {/* Dark Theme */}
            <Card className="border-none shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {theme === "dark"
                      ? <Moon className="w-4 h-4 text-primary shrink-0" />
                      : <Sun className="w-4 h-4 text-primary shrink-0" />
                    }
                    <span className="font-medium text-sm">Dark Theme</span>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    aria-label="Toggle dark theme"
                    data-testid="switch-theme"
                  />
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
