"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Layout from "../components/Layout";

type UserProfile = {
    _id: string;
    email: string;
    name?: string;
    role: string;
    ssoProvider?: string;
    createdAt: string;
};

type AllUser = {
    _id: string;
    email: string;
    name?: string;
    role: string;
    ssoProvider?: string;
};

const ROLES = ["Director", "Division Head", "Risk Analyst", "Staff"] as const;

export default function ProfilePage() {
    const { data: session, status, update } = useSession();
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Profile form state
    const [name, setName] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // User management (Director only)
    const [users, setUsers] = useState<AllUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [roleUpdating, setRoleUpdating] = useState<string | null>(null);

    // MFA state
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [mfaStep, setMfaStep] = useState<"idle" | "setup" | "backup">("idle");
    const [mfaSecret, setMfaSecret] = useState("");
    const [mfaQr, setMfaQr] = useState("");
    const [mfaToken, setMfaToken] = useState("");
    const [mfaDisableToken, setMfaDisableToken] = useState("");
    const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([]);
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaMessage, setMfaMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const sessionUser = session?.user as { id: string; role: string } | undefined;
    const isDirector = sessionUser?.role === "Director";

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        } else if (status === "authenticated") {
            void fetchProfile();
            if (isDirector) void fetchAllUsers();
        }
    }, [status, isDirector]);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/user/profile");
            const data = await res.json();
            if (data.success) {
                setProfile(data.user);
                setName(data.user.name ?? "");
                setMfaEnabled(data.user.mfaEnabled ?? false);
            }
        } catch {
            setMessage({ type: "error", text: "Failed to load profile." });
        } finally {
            setLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            setUsersLoading(true);
            // Fetch all users by querying each known user — we use the companies list
            // as a proxy. Instead, we add a dedicated endpoint via GET /api/user/profile
            // which returns the current user. For the user list we call /api/companies/list
            // and cross-reference. Since we don't have a user-list endpoint, we'll build
            // the list from the signup flow. For now, we expose a simple list endpoint.
            const res = await fetch("/api/user/list");
            const data = await res.json();
            if (data.success) setUsers(data.users);
        } catch {
            // silently fail — user list is a bonus feature
        } finally {
            setUsersLoading(false);
        }
    };

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: "error", text: "New passwords do not match." });
            return;
        }

        try {
            setSaving(true);
            const body: Record<string, string> = { name };
            if (newPassword) {
                body.currentPassword = currentPassword;
                body.newPassword = newPassword;
            }

            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                setMessage({ type: "error", text: data.error ?? "Failed to update profile." });
                return;
            }

            setProfile((prev) => prev ? { ...prev, name: data.user.name } : prev);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            // Refresh session so the name updates in the UI
            await update({ name: data.user.name });
            setMessage({ type: "success", text: "Profile updated successfully." });
        } catch {
            setMessage({ type: "error", text: "An unexpected error occurred." });
        } finally {
            setSaving(false);
        }
    };

    const startMfaSetup = async () => {
        setMfaMessage(null);
        setMfaLoading(true);
        try {
            const res = await fetch("/api/mfa/setup", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setMfaSecret(data.secret);
                setMfaQr(data.qrDataUrl);
                setMfaToken("");
                setMfaStep("setup");
            }
        } catch {
            setMfaMessage({ type: "error", text: "Failed to start MFA setup." });
        } finally {
            setMfaLoading(false);
        }
    };

    const confirmMfaEnable = async (e: React.FormEvent) => {
        e.preventDefault();
        setMfaMessage(null);
        setMfaLoading(true);
        try {
            const res = await fetch("/api/mfa/enable", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secret: mfaSecret, token: mfaToken }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setMfaMessage({ type: "error", text: data.error ?? "Verification failed." });
                return;
            }
            setMfaBackupCodes(data.backupCodes);
            setMfaEnabled(true);
            setMfaStep("backup");
        } catch {
            setMfaMessage({ type: "error", text: "An error occurred." });
        } finally {
            setMfaLoading(false);
        }
    };

    const handleMfaDisable = async (e: React.FormEvent) => {
        e.preventDefault();
        setMfaMessage(null);
        setMfaLoading(true);
        try {
            const res = await fetch("/api/mfa/disable", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: mfaDisableToken }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setMfaMessage({ type: "error", text: data.error ?? "Failed to disable MFA." });
                return;
            }
            setMfaEnabled(false);
            setMfaDisableToken("");
            setMfaMessage({ type: "success", text: "MFA has been disabled." });
        } catch {
            setMfaMessage({ type: "error", text: "An error occurred." });
        } finally {
            setMfaLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            setRoleUpdating(userId);
            const res = await fetch(`/api/user/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setUsers((prev) =>
                    prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
                );
            }
        } catch {
            // silently fail
        } finally {
            setRoleUpdating(null);
        }
    };

    if (status === "loading" || loading) {
        return (
            <Layout>
                <div className="flex h-64 items-center justify-center text-slate-400">Loading...</div>
            </Layout>
        );
    }

    if (!session) return null;

    return (
        <Layout>
            <div className="mx-auto max-w-2xl space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">My Profile</h1>
                    <p className="text-sm text-slate-400">Manage your account information and password.</p>
                </div>

                {/* Profile info card */}
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
                    <div className="mb-4 flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                            {(profile?.name ?? profile?.email ?? "?")[0].toUpperCase()}
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-white">{profile?.name || "—"}</p>
                            <p className="text-sm text-slate-400">{profile?.email}</p>
                            <span className="mt-1 inline-block rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                                {profile?.role}
                            </span>
                            {profile?.ssoProvider && (
                                <span className="ml-2 inline-block rounded-full bg-indigo-700 px-2 py-0.5 text-xs text-white capitalize">
                                    {profile.ssoProvider} SSO
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">
                        Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}
                    </p>
                </div>

                {/* Edit form */}
                <form onSubmit={handleProfileSave} className="rounded-lg border border-slate-700 bg-slate-800 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Edit Profile</h2>

                    {message && (
                        <div
                            className={`rounded-md px-4 py-3 text-sm ${message.type === "success"
                                ? "bg-green-900/50 text-green-300 border border-green-700"
                                : "bg-red-900/50 text-red-300 border border-red-700"
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-sm text-slate-400">Display Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm text-slate-400">Email</label>
                        <input
                            type="email"
                            value={profile?.email ?? ""}
                            disabled
                            className="w-full rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-slate-500 cursor-not-allowed"
                        />
                    </div>

                    {/* Password change — only for credential accounts */}
                    {!profile?.ssoProvider && (
                        <>
                            <hr className="border-slate-700" />
                            <h3 className="text-sm font-medium text-slate-300">Change Password</h3>
                            <div>
                                <label className="mb-1 block text-sm text-slate-400">Current Password</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Leave blank to keep current password"
                                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-slate-400">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-slate-400">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repeat new password"
                                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </form>

                {/* MFA section */}
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
                            <p className="text-sm text-slate-400">
                                {mfaEnabled ? "MFA is currently enabled on your account." : "Add an extra layer of security to your account."}
                            </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${mfaEnabled ? "bg-green-900/60 text-green-300" : "bg-slate-700 text-slate-400"}`}>
                            {mfaEnabled ? "Enabled" : "Disabled"}
                        </span>
                    </div>

                    {mfaMessage && (
                        <div className={`rounded-md px-4 py-3 text-sm ${mfaMessage.type === "success" ? "bg-green-900/50 text-green-300 border border-green-700" : "bg-red-900/50 text-red-300 border border-red-700"}`}>
                            {mfaMessage.text}
                        </div>
                    )}

                    {/* Setup flow */}
                    {!mfaEnabled && mfaStep === "idle" && (
                        <button
                            onClick={startMfaSetup}
                            disabled={mfaLoading}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                        >
                            {mfaLoading ? "Loading..." : "Enable MFA"}
                        </button>
                    )}

                    {mfaStep === "setup" && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-300">
                                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.
                            </p>
                            <div className="flex justify-center">
                                <Image src={mfaQr} alt="MFA QR Code" width={200} height={200} className="rounded-md border border-slate-600" />
                            </div>
                            <p className="text-center text-xs text-slate-500">
                                Can&apos;t scan? Enter this key manually: <span className="font-mono text-slate-300 break-all">{mfaSecret}</span>
                            </p>
                            <form onSubmit={confirmMfaEnable} className="flex gap-2">
                                <input
                                    type="text"
                                    value={mfaToken}
                                    onChange={(e) => setMfaToken(e.target.value)}
                                    placeholder="6-digit code"
                                    maxLength={6}
                                    inputMode="numeric"
                                    required
                                    className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    type="submit"
                                    disabled={mfaLoading || mfaToken.length !== 6}
                                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                                >
                                    {mfaLoading ? "Verifying..." : "Confirm"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMfaStep("idle"); setMfaMessage(null); }}
                                    className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
                                >
                                    Cancel
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Backup codes — shown once after enabling */}
                    {mfaStep === "backup" && (
                        <div className="space-y-3">
                            <div className="rounded-md border border-amber-700 bg-amber-900/30 p-4">
                                <p className="text-sm font-medium text-amber-300 mb-2">Save your backup codes</p>
                                <p className="text-xs text-amber-400 mb-3">
                                    Store these codes somewhere safe. Each can be used once if you lose access to your authenticator app.
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {mfaBackupCodes.map((code) => (
                                        <span key={code} className="rounded bg-slate-900 px-3 py-1 text-center font-mono text-sm text-white">
                                            {code}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={() => { setMfaStep("idle"); setMfaBackupCodes([]); setMfaMessage({ type: "success", text: "MFA enabled successfully." }); }}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                            >
                                I&apos;ve saved my backup codes
                            </button>
                        </div>
                    )}

                    {/* Disable flow */}
                    {mfaEnabled && mfaStep === "idle" && (
                        <form onSubmit={handleMfaDisable} className="space-y-3">
                            <p className="text-sm text-slate-400">Enter your current authenticator code (or a backup code) to disable MFA.</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={mfaDisableToken}
                                    onChange={(e) => setMfaDisableToken(e.target.value)}
                                    placeholder="Code"
                                    required
                                    className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                                <button
                                    type="submit"
                                    disabled={mfaLoading || !mfaDisableToken}
                                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                                >
                                    {mfaLoading ? "Disabling..." : "Disable MFA"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* User management — Director only */}
                {isDirector && (
                    <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-white">User Permissions</h2>
                        <p className="text-sm text-slate-400">As a Director, you can change the role of any user.</p>

                        {usersLoading ? (
                            <p className="text-slate-400 text-sm">Loading users...</p>
                        ) : users.length === 0 ? (
                            <p className="text-slate-500 text-sm">No other users found.</p>
                        ) : (
                            <div className="space-y-3">
                                {users
                                    .filter((u) => u._id !== sessionUser?.id)
                                    .map((u) => (
                                        <div
                                            key={u._id}
                                            className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-4 py-3"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-white">{u.name || u.email}</p>
                                                <p className="text-xs text-slate-400">{u.email}</p>
                                            </div>
                                            <select
                                                value={u.role}
                                                disabled={roleUpdating === u._id}
                                                onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                                className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white disabled:opacity-50"
                                            >
                                                {ROLES.map((r) => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
}
