"use client";

import { useState } from "react";
import { Users, ShieldAlert, Smartphone, ExternalLink, LogOut, KeyRound, ChevronRight } from "lucide-react";
import {
  ROLE_LABELS,
  canManageUsers,
  canReviewDeletions,
  type UserProfile,
} from "@/components/helpers";
import { authFetch } from "@/lib/authClient";
import type { NavModule } from "./LeftNav";

function scopeLine(user: UserProfile): string {
  if (user.is_training_account) {
    return "Training login — this session can see all live survey records on the server.";
  }
  if (user.role === "master_admin" || user.role === "ict_admin" || user.role === "national_coordinator") {
    return "National scope — all provinces.";
  }
  if (user.role === "provincial_coordinator") {
    return user.province ? `Provincial scope — ${user.province}.` : "Provincial scope — province is not set on this account.";
  }
  if (user.role === "district_coordinator" || user.role === "data_collector") {
    const bits = [user.district, user.province].filter(Boolean);
    return bits.length
      ? `District scope — ${bits.join(", ")}.`
      : "District scope — jurisdiction is not set on this account.";
  }
  return "Survey access follows this account's role.";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <div style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
      <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function SettingsPage({
  currentUser,
  onNavSelect,
  onSignOut,
  onToast,
}: {
  currentUser: UserProfile;
  onNavSelect?: (m: NavModule) => void;
  onSignOut?: () => void;
  onToast?: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      onToast?.("New password must be at least 8 characters.", "error");
      return;
    }
    if (newPassword !== confirm) {
      onToast?.("New password and confirmation do not match.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Password change failed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      onToast?.(data.message || "Password updated.", "success");
    } catch (err: any) {
      onToast?.(err.message || "Password change failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "var(--font-body)",
    color: "var(--text-primary)",
    background: "#fff",
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--bg-app)", padding: "24px 28px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <section style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--green)", marginBottom: 10 }}>Signed in</div>
          <Row label="Name" value={currentUser.full_name || "—"} />
          <Row label="Email" value={currentUser.email || "—"} />
          <Row label="Role" value={ROLE_LABELS[currentUser.role] || currentUser.role} />
          <Row label="Province" value={currentUser.province?.trim() || "—"} />
          <Row label="District" value={currentUser.district?.trim() || "—"} />
          <Row label="Status" value={currentUser.is_active ? "Active" : "Inactive"} />
          {currentUser.is_training_account && <Row label="Account type" value="Training" />}
          {currentUser.is_super_admin && <Row label="Controller" value="Super admin" />}
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}>
            {scopeLine(currentUser)}
          </div>
        </section>

        <section style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--green)", marginBottom: 8 }}>Session</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45, margin: 0 }}>
            The dashboard signs out after 15 minutes of inactivity. Sign out now to lock this workstation.
          </p>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              style={{
                marginTop: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#fff",
                color: "#b91c1c",
                border: "1px solid rgba(185,28,28,0.35)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          )}
        </section>

        <section style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--green)", marginBottom: 8 }}>Password</div>
          {currentUser.is_training_account ? (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45, margin: 0 }}>
              The training login does not change its password from this page.
            </p>
          ) : (
            <form onSubmit={handlePassword} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                Current password
                <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required style={{ ...inputStyle, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                New password
                <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} style={{ ...inputStyle, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                Confirm new password
                <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} style={{ ...inputStyle, marginTop: 4 }} />
              </label>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  width: "fit-content",
                  background: "var(--green)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-body)",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <KeyRound size={14} /> {saving ? "Saving…" : "Update password"}
              </button>
            </form>
          )}
        </section>

        {(canManageUsers(currentUser) || canReviewDeletions(currentUser)) && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {canManageUsers(currentUser) && (
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Users size={18} color="#006633" />
                  <div style={{ fontFamily: "var(--font-title)", fontWeight: 800, fontSize: 15 }}>Users</div>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45, margin: "0 0 14px" }}>
                  Provision accounts and assign province or district scope. Credentials work on web and mobile.
                </p>
                <button
                  type="button"
                  onClick={() => onNavSelect?.("users")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "var(--green)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Open users <ChevronRight size={14} />
                </button>
              </div>
            )}
            {canReviewDeletions(currentUser) && (
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <ShieldAlert size={18} color="#b91c1c" />
                  <div style={{ fontFamily: "var(--font-title)", fontWeight: 800, fontSize: 15 }}>Deletion approvals</div>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45, margin: "0 0 14px" }}>
                  Review pending soft-delete requests on the supervisor chain.
                </p>
                <button
                  type="button"
                  onClick={() => onNavSelect?.("approvals")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#fff",
                    color: "#b91c1c",
                    border: "1px solid rgba(185,28,28,0.35)",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Open approvals <ChevronRight size={14} />
                </button>
              </div>
            )}
          </section>
        )}

        <section style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Smartphone size={18} color="#006633" />
            <div style={{ fontFamily: "var(--font-title)", fontWeight: 800, fontSize: 15 }}>Field collector app</div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45, margin: "0 0 14px" }}>
            Android APK for offline survey collection. Preview the forms in a browser before installing.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <a
              href="/download"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--green)",
                color: "#fff",
                textDecoration: "none",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <ExternalLink size={13} /> Download page
            </a>
            <a
              href="/collector"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#fff",
                color: "var(--green)",
                textDecoration: "none",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                border: "1px solid var(--border)",
              }}
            >
              <Smartphone size={13} /> Preview in browser
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
