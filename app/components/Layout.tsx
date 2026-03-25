"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import NotificationPanel from "./NotificationPanel";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Assessment", href: "/questionnaires" },
    { name: "Risk Analysis", href: "/risk-analysis" },
    { name: "Risk evaluation", href: "/risk-evaluation" },
    { name: "Risk Treatment", href: "/risk-treatment" },
    { name: "Report&Documentation", href: "/reports" },
    { name: "Risk Register", href: "/risks" },
    { name: "My Profile", href: "/profile" },
  ];

  // Fetch unread count on mount
  const refreshUnread = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data: { read: boolean }[] = await res.json();
      setUnreadCount(data.filter((n) => !n.read).length);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    void refreshUnread();
  }, []);

  // SSE: bump unread count when a new notification arrives
  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    const es = new EventSource("/api/notifications/stream");
    esRef.current = es;

    const handleNew = () => {
      setUnreadCount((c) => c + 1);
    };

    es.addEventListener("analysis", handleNew);
    es.addEventListener("critical_risk", handleNew);
    es.addEventListener("questionnaire", handleNew);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  // When the panel is closed, re-sync the count from DB
  const handlePanelClose = () => {
    setShowNotifications(false);
    void refreshUnread();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="flex">
        <aside className="w-64 bg-slate-800 border-r border-slate-700 h-screen sticky top-0 flex flex-col">
          <div className="p-4 border-b border-slate-700 flex items-center justify-center">
            <div className="w-full flex items-center justify-center">
              <Image src="/logo2.png" alt="CSRARS Logo" width={180} height={60} className="object-contain" priority />
            </div>
          </div>

          <nav className="p-4 flex-1">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`block px-4 py-2 rounded-md transition ${isActive
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:bg-slate-700 hover:text-white"
                        }`}
                    >
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Bottom area: Notifications & Sign Out */}
          <div className="p-4 border-t border-slate-700 space-y-2 relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition flex items-center justify-center gap-2 relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              Notifications
              {unreadCount > 0 && (
                <span className="absolute top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <NotificationPanel onClose={handlePanelClose} />
            )}

            <button
              onClick={async () => {
                await fetch("/api/mfa/clear", { method: "POST" });
                await signOut({ callbackUrl: "/login" });
              }}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition"
            >
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
