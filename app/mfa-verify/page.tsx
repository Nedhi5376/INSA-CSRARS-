"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";

function MfaVerifyForm() {
    const router = useRouter();
    const params = useSearchParams();

    const userId = params.get("uid") ?? "";
    const email = params.get("email") ?? "";
    const pw = params.get("pw") ?? "";

    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [useBackup, setUseBackup] = useState(false);

    useEffect(() => {
        // If no userId in URL, something went wrong — go back to login
        if (!userId) router.replace("/login");
    }, [userId, router]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // Step 1: validate the TOTP/backup code server-side
            const verifyRes = await fetch("/api/mfa/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, token: token.trim() }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
                setError(verifyData.error ?? "Invalid code. Please try again.");
                setLoading(false);
                return;
            }

            // Step 2: now that mfa_verified cookie is set, complete the signIn
            const result = await signIn("credentials", {
                email,
                password: pw,
                redirect: false,
            });

            // Step 3: always clear MFA cookies — whether signIn succeeded or not.
            // This ensures mfa_verified never lingers for a future login attempt.
            await fetch("/api/mfa/clear", { method: "POST" });

            if (result?.error) {
                setError("Authentication failed. Please go back and log in again.");
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="w-20 h-5 mx-auto mb-8 flex items-center justify-center">
                    <Image src="/logo2.png" alt="CSRARS Logo" width={240} height={80} className="object-contain" priority />
                </div>

                <div className="bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700">
                    <div className="mb-6 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white">Two-Factor Authentication</h1>
                        <p className="mt-1 text-sm text-slate-400">
                            {useBackup
                                ? "Enter one of your backup codes."
                                : "Enter the 6-digit code from your authenticator app."}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleVerify} className="space-y-4">
                        <div>
                            <label htmlFor="token" className="block text-sm font-medium text-slate-300 mb-2">
                                {useBackup ? "Backup Code" : "Authentication Code"}
                            </label>
                            <input
                                id="token"
                                type="text"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                required
                                autoComplete="one-time-code"
                                inputMode={useBackup ? "text" : "numeric"}
                                maxLength={useBackup ? 10 : 6}
                                placeholder={useBackup ? "XXXXXXXXXX" : "000000"}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-md text-white text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || token.trim().length === 0}
                            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Verifying..." : "Verify"}
                        </button>
                    </form>

                    <div className="mt-4 text-center space-y-2">
                        <button
                            type="button"
                            onClick={() => { setUseBackup(!useBackup); setToken(""); setError(""); }}
                            className="text-sm text-blue-400 hover:text-blue-300 transition"
                        >
                            {useBackup ? "Use authenticator app instead" : "Use a backup code instead"}
                        </button>
                        <div>
                            <button
                                type="button"
                                onClick={() => router.push("/login")}
                                className="text-sm text-slate-400 hover:text-slate-300 transition"
                            >
                                Back to login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MfaVerifyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
                Loading...
            </div>
        }>
            <MfaVerifyForm />
        </Suspense>
    );
}
