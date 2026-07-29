"use client";
import { useState } from "react";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, CheckCircle, AlertCircle, Key } from "lucide-react";
import { UserProfile } from "@/components/helpers";
import { setInactivityTimestamp } from "@/hooks/useInactivityTimeout";

interface LoginModalProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function LoginModal({ onLoginSuccess }: LoginModalProps) {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        setError(data.error || "Authentication failed. Please check your credentials.");
        setLoading(false);
        return;
      }

      // Save active session to localStorage & set inactivity timestamp
      localStorage.setItem("zim_roads_user", JSON.stringify(data.user));
      localStorage.setItem("zim_roads_token", data.token);
      setInactivityTimestamp();

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError("Network connection error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 30, 15, 0.88)",
      backdropFilter: "blur(8px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#ffffff",
        width: "100%",
        maxWidth: 440,
        borderRadius: 16,
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
        overflow: "hidden",
        border: "1px solid rgba(0, 102, 51, 0.2)",
      }}>
        {/* Ministry Top Header */}
        <div style={{
          background: "linear-gradient(135deg, #004d26 0%, #006633 100%)",
          padding: "24px 24px 20px",
          color: "#ffffff",
          textAlign: "center",
          borderBottom: "3px solid #FFD100",
        }}>
          <img
            src="/coat_of_arms.png"
            alt="Coat of Arms of Zimbabwe"
            style={{ height: 60, width: "auto", margin: "0 auto 10px", display: "block", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
          />
          <h2 style={{ fontFamily: "var(--font-title)", fontWeight: 800, fontSize: 16, letterSpacing: "0.5px", margin: "0 0 4px", color: "#FFD100" }}>
            ROADS CONDITION SURVEY
          </h2>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, letterSpacing: "0.3px" }}>
            Ministry of Transport &amp; Infrastructural Development
          </div>
          <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
            REPUBLIC OF ZIMBABWE
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 18, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#006633" }}>
              <ShieldCheck size={16} /> Secure Portal Authentication
            </div>
            <p style={{ fontSize: 11.5, color: "#64748b", margin: "4px 0 0" }}>
              Sign in with your registered Web &amp; Mobile credentials
            </p>
          </div>

          {error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 11.5,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Username / Email */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                EMAIL / USERNAME
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="e.g. ict.admin@transport.gov.zw"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 36px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                PASSWORD
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 36px 10px 36px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: 10,
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 2,
                  }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "#94a3b8" : "linear-gradient(135deg, #006633 0%, #004d26 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "12px",
                fontSize: 13,
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4,
                boxShadow: "0 4px 12px rgba(0,102,51,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 14, height: 14, border: "2px solid #fff", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Authenticating...
                </>
              ) : (
                <>
                  <Key size={15} /> Sign In to Web Portal
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
