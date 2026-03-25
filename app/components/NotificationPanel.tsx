"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type NotificationType = "questionnaire" | "analysis" | "critical_risk";

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    date: string;
    read: boolean;
    meta?: Record<string, unknown>;
}

// ── Badge label per type ──────────────────────────────────────────────────────
const TYPE_LABEL: Record<NotificationType, string> = {
    questionnaire: "New Response",
    analysis: "Analysis Done",
    critical_risk: "Critical Risk",
};

const TYPE_STYLE: Record<NotificationType, string> = {
    questionnaire: "bg-blue-900 text-blue-200",
    analysis: "bg-green-900 text-green-200",
    critical_risk: "bg-red-800 text-red-100",
};

const CARD_STYLE: Record<NotificationType, string> = {
    questionnaire: "border-slate-600/50",
    analysis: "border-slate-600/50",
    critical_risk: "border-red-700/60 bg-red-950/30",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotificationPanel({ onClose }: { onClose: () => void }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);
    const esRef = useRef<EventSource | null>(null);

    // ── Fetch from DB ────────────────────────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications");
            if (!res.ok) return;
            const data: Notification[] = await res.json();
            setNotifications(data);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Initial load ─────────────────────────────────────────────────────────
    useEffect(() => {
        void fetchNotifications();
    }, [fetchNotifications]);

    // ── SSE: listen for new notifications while panel is open ────────────────
    useEffect(() => {
        if (typeof window === "undefined" || !("EventSource" in window)) return;

        const es = new EventSource("/api/notifications/stream");
        esRef.current = es;

        const handleEvent = () => {
            // Re-fetch from DB so we get the persisted record with correct id/read state
            void fetchNotifications();
        };

        es.addEventListener("analysis", handleEvent);
        es.addEventListener("critical_risk", handleEvent);
        es.addEventListener("questionnaire", handleEvent);

        return () => {
            es.close();
            esRef.current = null;
        };
    }, [fetchNotifications]);

    // ── Mark one as read ─────────────────────────────────────────────────────
    const markRead = async (id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        try {
            await fetch(`/api/notifications/${id}`, { method: "PATCH" });
        } catch {
            // optimistic update already applied — silently ignore
        }
    };

    // ── Mark all as read ─────────────────────────────────────────────────────
    const markAllRead = async () => {
        setMarkingAll(true);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        try {
            await fetch("/api/notifications/read-all", { method: "PATCH" });
        } catch {
            // silently ignore
        } finally {
            setMarkingAll(false);
        }
    };

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="absolute left-full bottom-12 ml-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-100">Notifications</h3>
                    {unreadCount > 0 && (
                        <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            disabled={markingAll}
                            className="text-xs text-blue-400 hover:text-blue-300 transition disabled:opacity-50"
                        >
                            Mark all read
                        </button>
                    )}
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {loading ? (
                    <div className="text-center p-4 text-slate-400">Loading...</div>
                ) : notifications.length === 0 ? (
                    <div className="text-center p-4 text-slate-400">No notifications</div>
                ) : (
                    notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => { if (!notif.read) void markRead(notif.id); }}
                            className={`p-3 rounded-md transition border cursor-pointer
                ${CARD_STYLE[notif.type]}
                ${notif.read ? "bg-slate-700/30 opacity-70" : "bg-slate-700/60 hover:bg-slate-700"}
              `}
                        >
                            <div className="flex items-start justify-between mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${TYPE_STYLE[notif.type]}`}>
                                    {TYPE_LABEL[notif.type]}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {!notif.read && (
                                        <span className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                                    )}
                                    <span className="text-xs text-slate-400">
                                        {new Date(notif.date).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <h4 className="text-sm font-medium text-slate-200 mb-0.5">{notif.title}</h4>
                            <p className="text-xs text-slate-400">{notif.message}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
