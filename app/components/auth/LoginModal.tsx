"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { auth, googleProvider } from "@/lib/firebase/auth";
import { db } from "@/lib/firebase/firestore";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

type Tab = "signin" | "signup";

interface LoginModalProps {
  isOpen: boolean;
}

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/wrong-password": "Wrong password. Please try again.",
  "auth/user-not-found": "No account found with this email.",
  "auth/email-already-in-use": "Email already in use.",
  "auth/invalid-email": "Invalid email address.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/popup-closed-by-user": "Sign-in popup was closed.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/invalid-credential": "Invalid credentials. Please try again.",
};

function mapFirebaseError(err: unknown): string {
  if (err instanceof FirebaseError) {
    return FIREBASE_ERRORS[err.code] ?? err.message;
  }
  return err instanceof Error ? err.message : "An unexpected error occurred.";
}

async function syncUser(token: string) {
  await fetch("/api/auth/sync-user", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export default function LoginModal({ isOpen }: LoginModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  if (!isOpen) return null;

  const clearErrors = () => {
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);
  };

  const handleGoogleSignIn = async () => {
    clearErrors();
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      await syncUser(token);
      router.push("/dashboard");
    } catch (err) {
      setGeneralError(mapFirebaseError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (tab === "signup" && password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setEmailLoading(true);
    try {
      if (tab === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const token = await result.user.getIdToken();
        // Write initial user doc to Firestore
        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName ?? "",
          createdAt: serverTimestamp(),
          onboardingCompleted: false,
        });
        await syncUser(token);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const token = await result.user.getIdToken();
        await syncUser(token);
      }
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code.includes("email")) {
          setEmailError(mapFirebaseError(err));
        } else if (err.code.includes("password") || err.code.includes("credential")) {
          setPasswordError(mapFirebaseError(err));
        } else {
          setGeneralError(mapFirebaseError(err));
        }
      } else {
        setGeneralError(mapFirebaseError(err));
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setEmailError("Enter your email above first.");
      return;
    }
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setForgotSent(true);
    } catch (err) {
      setEmailError(mapFirebaseError(err));
    } finally {
      setForgotLoading(false);
    }
  };

  const isAnyLoading = googleLoading || emailLoading || forgotLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
      {/* Non-dismissible: no onClick on backdrop */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 w-full max-w-md mx-4">
        {/* Tabs */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          {(["signin", "signup"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); clearErrors(); setForgotSent(false); }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {t === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* General error */}
        {generalError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {generalError}
          </div>
        )}

        {/* Google button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isAnyLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors mb-4 disabled:opacity-50"
        >
          {googleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Continue with Google
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">or</span>
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError(null); }}
              required
              disabled={isAnyLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50 ${
                emailError ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="you@example.com"
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-500">{emailError}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError(null); }}
                required
                disabled={isAnyLoading}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50 ${
                  passwordError ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1 text-xs text-red-500">{passwordError}</p>
            )}

            {/* Forgot password — Sign In only */}
            {tab === "signin" && (
              <div className="mt-1.5">
                {forgotSent ? (
                  <p className="text-xs text-green-600">Password reset email sent!</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={forgotLoading}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {forgotLoading ? "Sending…" : "Forgot password?"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Confirm password — Sign Up only */}
          {tab === "signup" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordError(null); }}
                required
                disabled={isAnyLoading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50 ${
                  passwordError ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isAnyLoading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {tab === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
