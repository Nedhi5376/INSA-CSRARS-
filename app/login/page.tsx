"use client";
import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<"google" | "github" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        if (result.error.startsWith("MFA_REQUIRED:")) {
          const userId = result.error.replace("MFA_REQUIRED:", "");
          await fetch("/api/mfa/pending", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          router.push(
            `/mfa-verify?uid=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`
          );
          return;
        }
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSsoLoading("google");
    setError("");
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (err) {
      console.error(err);
      setError("Google sign-in failed. Please try again.");
      setSsoLoading(null);
    }
  };

  const handleGitHubSignIn = async () => {
    setSsoLoading("github");
    setError("");
    try {
      await signIn("github", { callbackUrl: "/dashboard" });
    } catch (err) {
      console.error(err);
      setError("GitHub sign-in failed. Please try again.");
      setSsoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="w-20 h-5 mx-auto mb-8 flex items-center justify-center">
          <Image src="/logo2.png" alt="CSRARS Logo" width={240} height={80} className="object-contain" priority />
        </div>
        <div className="bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">Login</h1>
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input
                id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-slate-600" />
            <span className="mx-3 text-slate-400 text-sm">or</span>
            <div className="flex-1 border-t border-slate-600" />
          </div>
          <button
            type="button" onClick={handleGoogleSignIn} disabled={ssoLoading !== null}
            className="w-full flex items-center justify-center gap-3 py-2 px-4 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            {ssoLoading === "google" ? "Redirecting..." : "Sign in with Google"}
          </button>
          <button
            type="button" onClick={handleGitHubSignIn} disabled={ssoLoading !== null}
            className="mt-3 w-full flex items-center justify-center gap-3 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {ssoLoading === "github" ? "Redirecting..." : "Sign in with GitHub"}
          </button>
          <p className="mt-4 text-center text-slate-400 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-blue-400 hover:text-blue-300">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
