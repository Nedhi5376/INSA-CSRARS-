"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import NotificationPanel from "./NotificationPanel";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Assessment", href: "/questionnaires" },
    { name:"Risk Analysis", href:"/risk-analysis" },
    { name: "Risk evaluation", href: "/risk-evaluation" },
    { name: "Risk Treatment", href: "/risk-treatment" },
    { name: "Report&Documentation", href: "/reports" },
    { name: "Risk Register", href: "/risks" },
  ];

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
              className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
              </svg>
              Notifications
            </button>

            {showNotifications && (
              <NotificationPanel onClose={() => setShowNotifications(false)} />
            )}

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
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

