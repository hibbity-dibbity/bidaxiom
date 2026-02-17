"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

async function isSessionValid(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return false;
    const { accessToken } = await res.json();
    if (!accessToken) return false;

    // Decode JWT payload (base64url -> base64 -> JSON)
    const payloadB64 = accessToken
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const payload = JSON.parse(atob(payloadB64)) as { exp: number };

    // Mark invalid 60 seconds before actual expiry
    return payload.exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

export function useSessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    async function checkAndRedirect() {
      const valid = await isSessionValid();
      if (!valid) {
        window.location.href =
          "/sign-in?redirect_url=" +
          encodeURIComponent(window.location.pathname + window.location.search);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkAndRedirect();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = setInterval(checkAndRedirect, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);
}
