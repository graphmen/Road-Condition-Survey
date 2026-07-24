"use client";

import React, { useState, useEffect } from "react";
import { UserProfile, UserRole, ROLE_LABELS, canProvisionRole } from "@/components/helpers";
import { Users, UserPlus, Shield, MapPin, CheckCircle, AlertCircle, RefreshCw, Key, Lock } from "lucide-react";

interface UserManagementPanelProps {
  currentUser: UserProfile;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
}

const PROVINCES = [
  "Harare",
  "Bulawayo",
  "Manicaland",
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Masvingo",
  "Matabeleland North",
  "Matabeleland South",
  "Midlands"
];

const DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
  Harare: ["Harare", "Chitungwiza", "Epworth"],
  Bulawayo: ["Bulawayo"],
  Manicaland: ["Buhera", "Chimanimani", "Chipinge", "Makoni", "Mutare", "Mutasa", "Nyanga"],
  "Mashonaland West": ["Chegutu", "Hurungwe", "Kariba", "Makonde", "Mhondoro-Ngezi", "Sanyati", "Zvimba"],
  "Mashonaland East": ["Chikomba", "Goromonzi", "Marondera", "Mudzi", "Murehwa", "Mutoko", "Sekey", "Urumbo"],
  Masvingo: ["Bikita", "Chiredzi", "Chivi", "Gutu", "Masvingo", "Mwenezi", "Zaka"],
  Midlands: ["Chirumhanzu", "Gweru", "Gokwe North", "Gokwe South", "Kwekwe", "Mberengwa", "Shurugwi", "Zvishavane"],
  "Matabeleland South": ["Beitbridge", "Bulilima", "Gwanda", "Insiza", "Matobo", "Mangwe", "Umzingwane"]
};

export default function UserManagementPanel({ currentUser, onToast }: UserManagementPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [targetRole, setTargetRole] = useState<UserRole>("data_collector");
  const [province, setProvince] = useState(currentUser.province || "Harare");
  const [district, setDistrict] = useState(currentUser.district || "Harare");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-lock location fields based on supervisor scope
  useEffect(() => {
    if (currentUser.role === "provincial_coordinator" && currentUser.province) {
      setProvince(currentUser.province);
      setTargetRole("district_coordinator");
    } else if (currentUser.role === "district_coordinator") {
      if (currentUser.province) setProvince(currentUser.province);
      if (currentUser.district) setDistrict(currentUser.district);
      setTargetRole("data_collector");
    } else if (currentUser.role === "national_coordinator") {
      setTargetRole("provincial_coordinator");
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        role: currentUser.role,
        province: currentUser.province || "",
        district: currentUser.district || ""
      });
      const res = await fetch(`/api/users?${query}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error("Error loading users:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      onToast("Please enter Full Name and Email Address", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone_number: phone,
          role: targetRole,
          province: targetRole === "master_admin" || targetRole === "national_coordinator" ? null : province,
          district: targetRole === "district_coordinator" || targetRole === "data_collector" ? district : null,
          creator_role: currentUser.role
        })
      });
      const data = await res.json();
      if (data.success) {
        onToast(`Account created! Activation link sent to ${email}`, "success");
        setShowCreateModal(false);
        setFullName("");
        setEmail("");
        setPhone("");
        fetchUsers();
      } else {
        onToast(data.error || "Failed to create account", "error");
      }
    } catch (e: any) {
      onToast(e.message || "Failed to create account", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case "master_admin": return { bg: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" };
      case "national_coordinator": return { bg: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" };
      case "provincial_coordinator": return { bg: "rgba(37,99,235,0.1)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.2)" };
      case "district_coordinator": return { bg: "rgba(217,119,6,0.1)", color: "#d97706", border: "1px solid rgba(217,119,6,0.2)" };
      default: return { bg: "rgba(0,102,51,0.1)", color: "#006633", border: "1px solid rgba(0,102,51,0.2)" };
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-app)", overflow: "hidden" }}>
      
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "16px 24px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={20} color="#006633" /> Hierarchical User Provisioning &amp; Access Controls
          </h2>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
            Provision team accounts, enforce jurisdiction scopes, and manage active system privileges.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={fetchUsers}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} className={isLoading ? "spin-icon" : ""} /> Refresh
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#006633", color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <UserPlus size={15} /> Provision New Account
          </button>
        </div>
      </div>

      {/* Scope Banner */}
      <div style={{ background: "rgba(0,102,51,0.06)", borderBottom: "1px solid rgba(0,102,51,0.12)", padding: "10px 24px", fontSize: 11, color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={14} color="#006633" />
          <span>Active Session Scope: <strong>{ROLE_LABELS[currentUser.role]}</strong></span>
          {currentUser.province && <span style={{ background: "#fff", padding: "2px 8px", borderRadius: 12, border: "1px solid var(--border)", fontWeight: 700, fontSize: 10 }}>📍 Province: {currentUser.province}</span>}
          {currentUser.district && <span style={{ background: "#fff", padding: "2px 8px", borderRadius: 12, border: "1px solid var(--border)", fontWeight: 700, fontSize: 10 }}>📍 District: {currentUser.district}</span>}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>
          Unified Web &amp; Mobile Credentials Enabled
        </div>
      </div>

      {/* User Table Workspace */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240, color: "var(--text-muted)", fontSize: 12, flexDirection: "column", gap: 10 }}>
            <div style={{ width: 28, height: 28, border: "3px solid rgba(0,102,51,0.15)", borderTop: "3px solid #006633", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Loading accounts...
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)", background: "#fff", borderRadius: 12, border: "1px solid var(--border)" }}>
            <Users size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>No sub-accounts provisioned yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click "Provision New Account" above to invite users within your scope.</div>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <th style={{ padding: "12px 16px" }}>Full Name &amp; Email</th>
                  <th style={{ padding: "12px 16px" }}>Role Level</th>
                  <th style={{ padding: "12px 16px" }}>Assigned Jurisdiction</th>
                  <th style={{ padding: "12px 16px" }}>Contact</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const b = getRoleBadgeStyle(u.role);
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{u.full_name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{u.email}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ background: b.bg, color: b.color, border: b.border, padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {u.province || u.district ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {u.province && <span style={{ background: "var(--bg-app)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 10, fontWeight: 700 }}>Province: {u.province}</span>}
                            {u.district && <span style={{ background: "var(--bg-app)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 10, fontWeight: 700 }}>District: {u.district}</span>}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700 }}>Global (Entire Nation)</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--text-secondary)", fontWeight: 600 }}>
                        {u.phone_number || "—"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ background: u.is_active ? "rgba(0,102,51,0.1)" : "rgba(220,38,38,0.1)", color: u.is_active ? "#006633" : "#dc2626", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>
                          {u.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account Provisioning Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, maxWidth: 500, width: "100%", padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <UserPlus size={18} color="#006633" /> Provision New User Account
              </h3>
              <button onClick={() => setShowCreateModal(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eng. T. Mutasa"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Official Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@transport.gov.zw"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Phone Number</label>
                <input
                  type="text"
                  placeholder="+263 77 ..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, boxSizing: "border-box" }}
                />
              </div>

              {/* Target Role Selector */}
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Role Level</label>
                <select
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value as UserRole)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, background: "#fff", fontWeight: 700, boxSizing: "border-box" }}
                >
                  {currentUser.role === "master_admin" && <option value="national_coordinator">National Coordinator</option>}
                  {(currentUser.role === "master_admin" || currentUser.role === "national_coordinator") && <option value="provincial_coordinator">Provincial Coordinator</option>}
                  {(currentUser.role === "master_admin" || currentUser.role === "national_coordinator" || currentUser.role === "provincial_coordinator") && <option value="district_coordinator">District Coordinator</option>}
                  <option value="data_collector">Data Collector (Field Surveyor)</option>
                </select>
              </div>

              {/* Province Selector / Lock */}
              {targetRole !== "master_admin" && targetRole !== "national_coordinator" && (
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                    Assigned Province {currentUser.role === "provincial_coordinator" || currentUser.role === "district_coordinator" ? "(Locked to Your Province)" : ""}
                  </label>
                  <select
                    disabled={currentUser.role === "provincial_coordinator" || currentUser.role === "district_coordinator"}
                    value={province}
                    onChange={e => {
                      setProvince(e.target.value);
                      if (DISTRICTS_BY_PROVINCE[e.target.value]) {
                        setDistrict(DISTRICTS_BY_PROVINCE[e.target.value][0]);
                      }
                    }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, background: "#fff", fontWeight: 700, boxSizing: "border-box" }}
                  >
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}

              {/* District Selector / Lock */}
              {(targetRole === "district_coordinator" || targetRole === "data_collector") && (
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                    Assigned District {currentUser.role === "district_coordinator" ? "(Locked to Your District)" : ""}
                  </label>
                  <select
                    disabled={currentUser.role === "district_coordinator"}
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, background: "#fff", fontWeight: 700, boxSizing: "border-box" }}
                  >
                    {(DISTRICTS_BY_PROVINCE[province] || [province]).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}

              <div style={{ background: "rgba(0,102,51,0.06)", border: "1px solid rgba(0,102,51,0.12)", padding: 12, borderRadius: 8, fontSize: 10.5, color: "var(--text-secondary)" }}>
                <strong>🔒 Security Protocol:</strong> An activation link with temporary credentials will be sent to the registered email address. Mandatory strong password setup will be required on first login.
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#006633", color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>
                  {isSubmitting ? "Provisioning..." : "Send Activation Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
