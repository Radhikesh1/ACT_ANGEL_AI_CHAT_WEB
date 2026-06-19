import { useState, useEffect } from "react";

export function Logo({ className = "w-14 h-14" }: { className?: string }) {
  const [isDark, setIsDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <img
      src={isDark ? "/assets/Logo_Dark.png" : "/assets/logo-Light.png"}
      alt="Act Angel AI"
      className={className}
    />
  );
}
