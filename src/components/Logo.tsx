import { useTheme } from "@/lib/theme-context";

export function Logo({ className = "w-14 h-14" }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <img
      src={
        theme === "dark" ? "/assets/Logo-Light.png" : "/assets/Logo_Dark.png"
      }
      alt="Chat Angel AI"
      className={className}
    />
  );
}
