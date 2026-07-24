"use client";
import { ClerkProvider } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export function ClerkProviderClient({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<any>(baseAppearance("light"));

  useEffect(() => {
    const sync = () => {
      const t = document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
      setAppearance(baseAppearance(t));
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  return (
    <ClerkProvider
      appearance={appearance}
      signInUrl="/signin"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/onboarding"
    >
      {children}
    </ClerkProvider>
  );
}

function baseAppearance(theme: "light" | "dark") {
  const primary = theme === "dark" ? "#3fbfa8" : "#0f6e63";
  return {
    variables: {
      colorPrimary: primary,
      colorText: theme === "dark" ? "#e8ecf2" : "#14171c",
      colorBackground: theme === "dark" ? "#1b1f26" : "#ffffff",
      colorInputBackground: theme === "dark" ? "#222730" : "#ffffff",
      colorInputText: theme === "dark" ? "#e8ecf2" : "#14171c",
      borderRadius: "10px",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    elements: {
      card: {
        boxShadow: "none",
        background: "transparent",
      },
      headerTitle: {
        fontFamily: "Instrument Serif, Georgia, serif",
        fontSize: "1.9rem",
        letterSpacing: "-0.01em",
      },
      formButtonPrimary: {
        boxShadow: "none",
        fontWeight: 500,
      },
    },
  };
}
