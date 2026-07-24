"use client";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";

export function GuestButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  function open() {
    setSession({
      name: "Guest",
      email: "guest@radioact.local",
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    router.push("/app");
  }
  return (
    <button onClick={open} className={className}>
      {children}
    </button>
  );
}
