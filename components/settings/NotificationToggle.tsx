"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function NotificationToggle() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default"
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPerm("unsupported");
    } else {
      setPerm(Notification.permission);
    }
  }, []);

  async function enable() {
    try {
      const result = await Notification.requestPermission();
      setPerm(result);
      if (result === "granted") {
        toast.success("Daily reminders on — we'll nudge you once a day.");
        new Notification("PrepPilot", {
          body: "You're all set — see you at your next drill 🔥",
          icon: "/icon.svg",
        });
      } else {
        toast.info("No problem — you can enable them anytime.");
      }
    } catch {
      toast.error("Couldn't enable notifications in this browser.");
    }
  }

  if (perm === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications aren&apos;t supported in this browser.
      </p>
    );
  }
  if (perm === "granted") {
    return (
      <p className="text-sm text-muted-foreground">
        ✅ Daily drill reminders are on for this device.
      </p>
    );
  }
  return (
    <Button size="sm" variant="outline" onClick={enable}>
      <Bell data-icon="inline-start" /> Enable daily reminders
    </Button>
  );
}
