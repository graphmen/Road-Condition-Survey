import React, { useEffect, useState } from "react";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, Key, Globe, Wifi } from "lucide-react";
import { assetUrl } from "../lib/assets";
import type { MobileUserProfile } from "../lib/auth";
import { saveMobileAuth } from "../lib/auth";
import { TRAINING_EMAIL, TRAINING_PASSWORD } from "../lib/trainingCredentials";
import {
  DEFAULT_SERVER_URL,
  ensureNativeServerUrl,
  normalizeServerUrl,
  resolveStoredServerUrl,
} from "../lib/serverConfig";

interface LoginScreenProps {
  serverUrl: string;
  onLoginSuccess: (user: MobileUserProfile) => void;
  onServerUrlChange?: (url: string) => void;
}

export function LoginScreen({ serverUrl, onLoginSuccess, onServerUrlChange }: LoginScreenProps) {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [backendUrl, setBackendUrl] = useState(() => resolveStoredServerUrl() || serverUrl || DEFAULT_SERVER_URL);

  useEffect(() => {
    const resolved = ensureNativeServerUrl();
    setBackendUrl(resolved);
    onServerUrlChange?.(resolved);
  }, [onServerUrlChange]);

  const persistServerUrl = (url: string) => {
    const normalized = normalizeServerUrl(url);
    setBackendUrl(normalized);
    localStorage.setItem("roads_server_url", normalized);
    onServerUrlChange?.(normalized);
  };

  const handleTestConnection = async () => {
    setError("");
    setTesting(true);
    try {
      const base = normalizeServerUrl(backendUrl);
      const res = await fetch(`${base}/api/roads`, { method: "GET" });
      if (!res.ok) {
        setError(`Server responded with status ${res.status}. Check the URL.`);
      } else {
        persistServerUrl(base);
      }
    } catch {
      setError(`Cannot reach ${normalizeServerUrl(backendUrl)}. Check Wi‑Fi/mobile data and the Server URL below.`);
    } finally {
      setTesting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError("Enter email and password.");
      return;
    }
    const base = normalizeServerUrl(backendUrl);
    persistServerUrl(base);
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameOrEmail: usernameOrEmail.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }
      saveMobileAuth(data.user, data.token);
      onLoginSuccess(data.user);
    } catch {
      setError(`Cannot reach ${base}. Check Server URL below and your internet connection.`);
      setLoading(false);
    }
  };

  return (
    <div className="mobile-app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="mobile-header">
        <div className="mobile-logo-group">
          <img src={assetUrl("coat_of_arms.png")} alt="Coat of Arms" className="mobile-coat" />
          <div className="mobile-header-title-container">
            <h1 className="mobile-header-title">MOTID COLLECT</h1>
            <span className="mobile-header-subtitle">Secure Sign In</span>
          </div>
        </div>
      </header>

      <div className="mobile-content" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{ width: "100%", maxWidth: 400, background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)", padding: 20 }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <ShieldCheck size={28} color="var(--accent-emerald)" style={{ marginBottom: 8 }} />
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Field Collector Login</h2>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              Use the same credentials as the web portal
            </p>
          </div>

          {error && (
            <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "var(--accent-rose)", borderRadius: 8, padding: 10, fontSize: 11, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="mobile-form-group">
              <label className="mobile-label">Server URL</label>
              <div style={{ position: "relative" }}>
                <Globe size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-muted)" }} />
                <input
                  type="url"
                  className="mobile-input"
                  style={{ paddingLeft: 34 }}
                  placeholder={DEFAULT_SERVER_URL}
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  required
                />
              </div>
              <button
                type="button"
                className="mobile-btn secondary"
                style={{ marginTop: 8, fontSize: 11 }}
                onClick={handleTestConnection}
                disabled={testing || !backendUrl.trim()}
              >
                <Wifi size={14} />
                <span>{testing ? "Testing..." : "Test connection"}</span>
              </button>
            </div>
            <div className="mobile-form-group">
              <label className="mobile-label">Email / Username</label>
              <div style={{ position: "relative" }}>
                <Mail size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-muted)" }} />
                <input
                  type="text"
                  className="mobile-input"
                  style={{ paddingLeft: 34 }}
                  placeholder="your.email@transport.gov.zw"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mobile-form-group">
              <label className="mobile-label">Password</label>
              <div style={{ position: "relative" }}>
                <Lock size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-muted)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  className="mobile-input"
                  style={{ paddingLeft: 34, paddingRight: 36 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", color: "var(--text-muted)" }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="mobile-btn" disabled={loading} style={{ marginTop: 4 }}>
              <Key size={14} />
              <span>{loading ? "Signing in..." : "Sign In"}</span>
            </button>
            <button
              type="button"
              className="mobile-btn secondary"
              style={{ marginTop: 0, fontSize: 11 }}
              onClick={() => {
                setUsernameOrEmail(TRAINING_EMAIL);
                setPassword(TRAINING_PASSWORD);
                setError("");
              }}
            >
              Use training account
            </button>
          </form>

          <div
            style={{
              marginTop: 14,
              padding: 10,
              borderRadius: 8,
              background: "var(--bg-active)",
              border: "1px solid var(--border-active)",
              fontSize: 10,
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "var(--accent-emerald)" }}>Training login</strong>
            <br />
            Email: {TRAINING_EMAIL}
            <br />
            Password: {TRAINING_PASSWORD}
          </div>
        </div>
      </div>
    </div>
  );
}
