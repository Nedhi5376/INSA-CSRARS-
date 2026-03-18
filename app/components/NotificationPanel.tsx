"use client";

import { useEffect, useState } from "react";
import axios from "axios";

interface Notification {
    id: string;
    type: "questionnaire" | "analysis";
    title: string;
    message: string;
    date: string;
    read: boolean;
}

export default function NotificationPanel({ onClose }: { onClose: () => void }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await axios.get("/api/notifications");
                setNotifications(response.data);
            } catch (error) {
                console.error("Failed to fetch notifications", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, []);

    return (
        <div className="absolute left-full bottom-12 ml-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                <h3 className="font-semibold text-slate-100">Notifications</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {loading ? (
                    <div className="text-center p-4 text-slate-400">Loading...</div>
                ) : notifications.length === 0 ? (
                    <div className="text-center p-4 text-slate-400">No notifications</div>
                ) : (
                    notifications.map((notif) => (
                        <div key={notif.id} className="p-3 bg-slate-700/50 rounded-md hover:bg-slate-700 transition border border-slate-600/50">
                            <div className="flex items-start justify-between mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${notif.type === 'questionnaire' ? 'bg-blue-900 text-blue-200' : 'bg-green-900 text-green-200'
                                    }`}>
                                    {notif.type === 'questionnaire' ? 'New Response' : 'Analysis Done'}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {new Date(notif.date).toLocaleDateString()}
                                </span>
                            </div>
                            <h4 className="text-sm font-medium text-slate-200 mb-1">{notif.title}</h4>
                            <p className="text-xs text-slate-400">{notif.message}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
