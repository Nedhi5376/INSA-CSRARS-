"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Layout from "../components/Layout";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
    _id: string;
    name?: string;
    email: string;
}

interface Conversation {
    _id: string;
    participants: Participant[];
    lastMessage: string;
    updatedAt: string;
    unread: number;
}

interface Message {
    _id: string;
    conversationId: string;
    senderId: Participant;
    text: string;
    readBy: string[];
    createdAt: string;
}

interface UserOption {
    _id: string;
    name?: string;
    email: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function convLabel(conv: Conversation, myId: string): string {
    const others = conv.participants.filter((p) => p._id !== myId);
    if (others.length === 0) return "Just you";
    return others.map((p) => p.name || p.email).join(", ");
}

function timeLabel(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString();
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MessagesPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const myId = (session?.user as { id?: string })?.id ?? "";

    // ── State ──────────────────────────────────────────────────────────────────
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [sending, setSending] = useState(false);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);

    // New conversation modal
    const [showNewConv, setShowNewConv] = useState(false);
    const [allUsers, setAllUsers] = useState<UserOption[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [creatingConv, setCreatingConv] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const esRef = useRef<EventSource | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ── Auth guard ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status === "unauthenticated") router.push("/login");
    }, [status, router]);

    // ── Fetch conversations ────────────────────────────────────────────────────
    const fetchConversations = useCallback(async () => {
        try {
            const res = await fetch("/api/messages/conversations");
            const data = await res.json();
            if (data.success) setConversations(data.conversations);
        } catch { /* silently ignore */ }
        finally { setLoadingConvs(false); }
    }, []);

    useEffect(() => { void fetchConversations(); }, [fetchConversations]);

    // ── Fetch messages for active conversation ─────────────────────────────────
    const fetchMessages = useCallback(async (convId: string) => {
        setLoadingMsgs(true);
        try {
            const res = await fetch(`/api/messages/conversations/${convId}`);
            const data = await res.json();
            if (data.success) setMessages(data.messages);
        } catch { /* silently ignore */ }
        finally { setLoadingMsgs(false); }
    }, []);

    useEffect(() => {
        if (!activeConvId) return;
        void fetchMessages(activeConvId);
        // Mark as read
        fetch("/api/messages/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: activeConvId }),
        }).catch(() => { });
        // Clear unread badge
        setConversations((prev) =>
            prev.map((c) => (c._id === activeConvId ? { ...c, unread: 0 } : c))
        );
    }, [activeConvId, fetchMessages]);

    // ── Auto-scroll ────────────────────────────────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ── SSE: real-time messages ────────────────────────────────────────────────
    useEffect(() => {
        if (status !== "authenticated") return;
        if (typeof window === "undefined" || !("EventSource" in window)) return;

        const es = new EventSource("/api/messages/stream");
        esRef.current = es;

        es.addEventListener("new_message", (e: MessageEvent) => {
            try {
                const msg: Message = JSON.parse(e.data);
                // Append to thread if it's the active conversation
                if (msg.conversationId === activeConvId) {
                    setMessages((prev) => {
                        if (prev.some((m) => m._id === msg._id)) return prev;
                        return [...prev, msg];
                    });
                    // Mark as read immediately
                    fetch("/api/messages/read", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ conversationId: msg.conversationId }),
                    }).catch(() => { });
                } else {
                    // Bump unread count for other conversations
                    setConversations((prev) =>
                        prev.map((c) =>
                            c._id === msg.conversationId
                                ? { ...c, lastMessage: msg.text, unread: c.unread + 1, updatedAt: msg.createdAt }
                                : c
                        )
                    );
                }
            } catch { /* ignore parse errors */ }
        });

        es.addEventListener("messages_read", (e: MessageEvent) => {
            try {
                const { conversationId } = JSON.parse(e.data) as { conversationId: string };
                if (conversationId === activeConvId) {
                    setMessages((prev) =>
                        prev.map((m) => ({ ...m, readBy: [...new Set([...m.readBy, myId])] }))
                    );
                }
            } catch { /* ignore */ }
        });

        return () => { es.close(); esRef.current = null; };
    }, [status, activeConvId, myId]);

    // ── Send message ───────────────────────────────────────────────────────────
    const handleSend = async () => {
        if (!activeConvId || !inputText.trim() || sending) return;
        setSending(true);
        const text = inputText.trim();
        setInputText("");
        try {
            await fetch("/api/messages/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversationId: activeConvId, text }),
            });
        } catch { /* silently ignore */ }
        finally { setSending(false); inputRef.current?.focus(); }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    // ── New conversation ───────────────────────────────────────────────────────
    const openNewConv = async () => {
        setShowNewConv(true);
        if (allUsers.length === 0) {
            try {
                const res = await fetch("/api/user/list");
                const data = await res.json();
                if (data.success) setAllUsers(data.users.filter((u: UserOption) => u._id !== myId));
            } catch { /* silently ignore */ }
        }
    };

    const createConversation = async () => {
        if (selectedUsers.length === 0) return;
        setCreatingConv(true);
        try {
            const res = await fetch("/api/messages/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ participantIds: selectedUsers }),
            });
            const data = await res.json();
            if (data.success) {
                setConversations((prev) => {
                    const exists = prev.find((c) => c._id === data.conversation._id);
                    if (exists) return prev;
                    return [{ ...data.conversation, unread: 0 }, ...prev];
                });
                setActiveConvId(data.conversation._id);
                setShowNewConv(false);
                setSelectedUsers([]);
            }
        } catch { /* silently ignore */ }
        finally { setCreatingConv(false); }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    if (status === "loading") {
        return (
            <Layout>
                <div className="flex h-64 items-center justify-center text-slate-400">Loading...</div>
            </Layout>
        );
    }

    const activeConv = conversations.find((c) => c._id === activeConvId);

    return (
        <Layout>
            <div className="flex h-[calc(100vh-4rem)] gap-0 rounded-lg overflow-hidden border border-slate-700">

                {/* ── Conversation list ─────────────────────────────────────────── */}
                <aside className="w-72 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
                    <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                        <h2 className="font-semibold text-white">Messages</h2>
                        <button
                            onClick={openNewConv}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition"
                        >
                            + New
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loadingConvs ? (
                            <p className="p-4 text-sm text-slate-400">Loading...</p>
                        ) : conversations.length === 0 ? (
                            <p className="p-4 text-sm text-slate-400">No conversations yet.</p>
                        ) : (
                            conversations.map((conv) => {
                                const label = convLabel(conv, myId);
                                const isActive = conv._id === activeConvId;
                                return (
                                    <button
                                        key={conv._id}
                                        onClick={() => setActiveConvId(conv._id)}
                                        className={`w-full text-left px-4 py-3 border-b border-slate-700/50 transition
                      ${isActive ? "bg-slate-700" : "hover:bg-slate-700/50"}`}
                                    >
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-sm font-medium text-white truncate max-w-[160px]">
                                                {label}
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {conv.unread > 0 && (
                                                    <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                                                        {conv.unread}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-400">{timeLabel(conv.updatedAt)}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">{conv.lastMessage || "No messages yet"}</p>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                {/* ── Chat thread ───────────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col bg-slate-900">
                    {!activeConvId ? (
                        <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
                            Select a conversation or start a new one
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="px-6 py-3 border-b border-slate-700 bg-slate-800">
                                <p className="font-medium text-white text-sm">
                                    {activeConv ? convLabel(activeConv, myId) : ""}
                                </p>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                                {loadingMsgs ? (
                                    <p className="text-center text-slate-400 text-sm">Loading...</p>
                                ) : messages.length === 0 ? (
                                    <p className="text-center text-slate-500 text-sm">No messages yet. Say hello!</p>
                                ) : (
                                    messages.map((msg) => {
                                        const isMine = String(msg.senderId?._id ?? msg.senderId) === myId;
                                        return (
                                            <div
                                                key={msg._id}
                                                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                                            >
                                                <div className={`max-w-[70%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                                                    {!isMine && (
                                                        <span className="text-[10px] text-slate-400 px-1">
                                                            {msg.senderId?.name || msg.senderId?.email || "Unknown"}
                                                        </span>
                                                    )}
                                                    <div
                                                        className={`rounded-2xl px-4 py-2 text-sm break-words
                              ${isMine
                                                                ? "bg-blue-600 text-white rounded-br-sm"
                                                                : "bg-slate-700 text-slate-100 rounded-bl-sm"
                                                            }`}
                                                    >
                                                        {msg.text}
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 px-1">
                                                        {timeLabel(msg.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={bottomRef} />
                            </div>

                            {/* Input */}
                            <div className="px-4 py-3 border-t border-slate-700 bg-slate-800">
                                <div className="flex gap-2 items-end">
                                    <textarea
                                        ref={inputRef}
                                        rows={1}
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                                        disabled={sending}
                                        className="flex-1 resize-none rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-h-32"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={sending || !inputText.trim()}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-40 flex-shrink-0"
                                    >
                                        {sending ? "…" : "Send"}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── New conversation modal ─────────────────────────────────────── */}
            {showNewConv && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-800">
                        <div className="border-b border-slate-700 p-5 flex items-center justify-between">
                            <h3 className="font-semibold text-white">New Conversation</h3>
                            <button
                                onClick={() => { setShowNewConv(false); setSelectedUsers([]); }}
                                className="text-slate-400 hover:text-white"
                            >✕</button>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-slate-400">Select one or more team members:</p>
                            <div className="max-h-60 overflow-y-auto space-y-1">
                                {allUsers.length === 0 ? (
                                    <p className="text-sm text-slate-500">Loading users...</p>
                                ) : (
                                    allUsers.map((u) => {
                                        const checked = selectedUsers.includes(u._id);
                                        return (
                                            <label
                                                key={u._id}
                                                className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-slate-700 transition"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() =>
                                                        setSelectedUsers((prev) =>
                                                            checked ? prev.filter((id) => id !== u._id) : [...prev, u._id]
                                                        )
                                                    }
                                                    className="accent-blue-500"
                                                />
                                                <span className="text-sm text-white">{u.name || u.email}</span>
                                                {u.name && <span className="text-xs text-slate-400">{u.email}</span>}
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <div className="border-t border-slate-700 p-5 flex gap-3">
                            <button
                                onClick={createConversation}
                                disabled={creatingConv || selectedUsers.length === 0}
                                className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-40"
                            >
                                {creatingConv ? "Creating..." : "Start Conversation"}
                            </button>
                            <button
                                onClick={() => { setShowNewConv(false); setSelectedUsers([]); }}
                                className="flex-1 rounded-md bg-slate-700 py-2 text-sm font-medium text-white hover:bg-slate-600 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
