"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Logo } from "./Logo";
import { getSession } from "@/lib/session";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(
      (document.documentElement.getAttribute("data-theme") as
        | "light"
        | "dark") || "light",
    );
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("radioact-theme", next);
    setTheme(next);
  }

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-200 ${
        scrolled
          ? "backdrop-blur bg-base/85 border-b hairline"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1200px] px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center text-accent">
          <Logo size={24} withWordmark />
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <a href="#how" className="btn btn-ghost !py-1.5 !px-3">
            How it works
          </a>
          <a href="#platform" className="btn btn-ghost !py-1.5 !px-3">
            Platform
          </a>
          <a href="#for-clinicians" className="btn btn-ghost !py-1.5 !px-3">
            For clinicians
          </a>
          <a href="#faq" className="btn btn-ghost !py-1.5 !px-3">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <button
            aria-label="Toggle theme"
            onClick={toggle}
            className="btn btn-ghost !py-1.5 !px-2.5 hidden sm:inline-flex"
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          {HAS_CLERK ? <ClerkCTAs /> : <DemoCTAs />}
        </div>
      </div>
    </header>
  );
}

function ClerkCTAs() {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return null;
  return isSignedIn ? (
    <Link href="/app" className="btn btn-primary !py-1.5 !px-3.5">
      Open RadioAct
    </Link>
  ) : (
    <>
      <Link href="/signin" className="btn btn-ghost !py-1.5 !px-3">
        Sign in
      </Link>
      <Link href="/signup" className="btn btn-primary !py-1.5 !px-3.5">
        Get started
      </Link>
    </>
  );
}

function DemoCTAs() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(!!getSession());
  }, []);
  return signedIn ? (
    <Link href="/app" className="btn btn-primary !py-1.5 !px-3.5">
      Open RadioAct
    </Link>
  ) : (
    <>
      <Link href="/signin" className="btn btn-ghost !py-1.5 !px-3">
        Sign in
      </Link>
      <Link href="/signup" className="btn btn-primary !py-1.5 !px-3.5">
        Get started
      </Link>
    </>
  );
}
