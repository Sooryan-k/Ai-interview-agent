"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (offline study pages) and — if the user has
 * already granted notification permission — fires a once-per-day local reminder
 * to do their drill. No permission is ever requested here (opt-in lives in
 * Settings), so this is silent for everyone who hasn't opted in.
 */
export function PwaBootstrap() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    try {
      if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const today = new Date().toISOString().slice(0, 10);
        const last = localStorage.getItem("preppilot:lastDrillNotify");
        if (last !== today) {
          localStorage.setItem("preppilot:lastDrillNotify", today);
          new Notification("PrepPilot", {
            body: "Your daily drill is ready — keep your streak alive 🔥",
            icon: "/icon.svg",
          });
        }
      }
    } catch {
      /* notifications unavailable — ignore */
    }
  }, []);

  return null;
}
