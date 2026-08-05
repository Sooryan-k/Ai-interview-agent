"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Stable placeholder before hydration so the icon doesn't flash/mismatch.
  if (!mounted) {
    return <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" />;
  }

  const dark = resolvedTheme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(dark ? "light" : "dark")}
          >
            {dark ? <Sun /> : <Moon />}
          </Button>
        }
      />
      <TooltipContent>
        Switch to {dark ? "light" : "dark"} mode
      </TooltipContent>
    </Tooltip>
  );
}
