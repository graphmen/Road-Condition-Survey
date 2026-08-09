"use client";
import { useState } from "react";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, Key, LifeBuoy } from "lucide-react";
import { UserProfile } from "@/components/helpers";
import { setInactivityTimestamp } from "@/hooks/useInactivityTimeout";
import { saveAuthSession, authFetch } from "@/lib/authClient";

interface LoginModalProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function LoginModal({ onLoginSuccess }: LoginModalProps) {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "recover" | "change">("login");
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [pendingToken, setPendingToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoverEmail, setRecoverEmail] = useState("");

  const finishLogin = (user: UserProfile, token: string) => {
    saveAuthSession(user, token);
    setInactivityTimestamp();
    onLoginSuccess(user);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError("Please enter both Email/Username and Password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameOrEmail: usernameOrEmail.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Authentication failed.");
        setLoading(false);
        return;
      }
      if (data.must_change_password) {
        setPendingUser(data.user);
        setPendingToken(data.token);
        saveAuthSession(data.user, data.token);
        setMode("change");
        setLoading(false);
        return;
      }
      finishLogin(data.user, data.token);
    } catch {
      setError("Network connection error. Please try again.");
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: password,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not update password.");
        setLoading(false);
        return;
      }
      const user = pendingUser!;
      finishLogin({ ...user, must_change_password: false }, pendingToken);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recoverEmail.trim(),
          recovery_key: recoveryKey.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Recovery failed.");
        setLoading(false);
        return;
      }
      setMode("login");
      setPassword("");
      setNewPassword("");
      setError("");
      setLoading(false);
      alert("Password recovered. Sign in with your new password.");
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0, 30, 15, 0.88)",
      backdropFilter: "blur(8px)", zIndex: 9999, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "#ffffff", width: "100%", maxWidth: 440, borderRadius: 16,
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)", overflow: "hidden",
        border: "1px solid rgba(0, 102, 51, 0.2)",
      }}>
        <div style={{
          background: "linear-gradient(135deg, #004d26 0%, #006633 100%)",
          padding: "24px 24px 20px", color: "#ffffff", textAlign: "center",
          borderBottom: "3px solid #FFD100",
        }}>
          <img src="/coat_of_arms.png" alt="Coat of Arms" style={{ height: 60, margin: "0 auto 10px", display: "block" }} />
          <h2 style={{ fontWeight: 800, fontSize: 16, margin: "0 0 4px", color: "#FFD100" }}>ROADS CONDITION SURVEY</h2>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>Ministry of Transport &amp; Infrastructural Development</div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 18, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#006633" }}>
              <ShieldCheck size={16} />
              {mode === "login" && "Secure Portal Authentication"}
              {mode === "change" && "Set Your New Password"}
              {mode === "recover" && "Super Admin Password Recovery"}
            </div>
            <p style={{ fontSize: 11.5, color: "#64748b", margin: "4px 0 0" }}>
              {mode === "login" && "Sign in with your registered Web & Mobile credentials"}
              {mode === "change" && "You must set a new password before continuing."}
              {mode === "recover" && "Use your Super Master Admin recovery key."}
            </p>
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 8, padding: "10px 12px", fontSize: 11.5, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 5 }}>EMAIL / USERNAME</label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                  <input type="text" placeholder="e.g. ict.admin@transport.gov.zw" value={usernameOrEmail} onChange={(e) => setUsernameOrEmail(e.target.value)} style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }} required />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 5 }}>PASSWORD</label>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                  <input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: "10px 36px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} style={{ background: loading ? "#94a3b8" : "#006633", color: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Key size={15} /> {loading ? "Authenticating..." : "Sign In"}
              </button>
              <button type="button" onClick={() => { setMode("recover"); setError(""); }} style={{ background: "none", border: "none", color: "#006633", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <LifeBuoy size={14} /> Forgot Super Master Admin password?
              </button>
            </form>
          )}

          {mode === "change" && (
            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input type="password" placeholder="New password (min 8 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }} required />
              <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }} required />
              <button type="submit" disabled={loading} style={{ background: "#006633", color: "#fff", border: "none", borderRadius: 8, padding: 12, fontWeight: 800, cursor: "pointer" }}>
                {loading ? "Saving..." : "Save & Continue"}
              </button>
            </form>
          )}

          {mode === "recover" && (
            <form onSubmit={handleRecover} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input type="email" placeholder="Super Master Admin email" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }} required />
              <input type="text" placeholder="Recovery key" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }} required />
              <input type="password" placeholder="New password (min 8 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }} required />
              <button type="submit" disabled={loading} style={{ background: "#006633", color: "#fff", border: "none", borderRadius: 8, padding: 12, fontWeight: 800, cursor: "pointer" }}>
                {loading ? "Recovering..." : "Recover Password"}
              </button>
              <button type="button" onClick={() => setMode("login")} style={{ background: "none", border: "none", color: "#64748b", fontSize: 11, cursor: "pointer" }}>Back to sign in</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
