"use client";

import React, { useState, useEffect } from "react";
import { UserProfile, DeletionRequest, ROLE_LABELS } from "@/components/helpers";
import { AlertOctagon, CheckCircle2, XCircle, RefreshCw, FileText, ShieldAlert, Clock } from "lucide-react";

interface DeletionApprovalsPanelProps {
  currentUser: UserProfile;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
  onRefreshRecords?: () => void;
}

export default function DeletionApprovalsPanel({ currentUser, onToast, onRefreshRecords }: DeletionApprovalsPanelProps) {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const fetchDeletions = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        role: currentUser.role,
        province: currentUser.province || "",
        district: currentUser.district || ""
      });
      const res = await fetch(`/api/deletions?${query}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error("Error fetching deletions:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletions();
  }, [currentUser]);

  const handleReview = async (decision: "approved" | "rejected") => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/deletions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_deletion",
          request_id: selectedRequest.id,
          reviewer_id: currentUser.id,
          reviewer_name: currentUser.full_name,
          reviewer_role: currentUser.role,
          decision,
          review_notes: reviewNotes
        })
      });
      const data = await res.json();
      if (data.success) {
        onToast(`Deletion request ${decision} successfully`, decision === "approved" ? "success" : "info");
        setSelectedRequest(null);
        setReviewNotes("");
        fetchDeletions();
        if (onRefreshRecords) onRefreshRecords();
      } else {
        onToast(data.error || "Failed to process review", "error");
      }
    } catch (e: any) {
      onToast(e.message || "Failed to process review", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingList = requests.filter(r => r.status === "pending");
  const historyList = requests.filter(r => r.status !== "pending");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-app)", overflow: "hidden" }}>
      
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "16px 24px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertOctagon size={20} color="#dc2626" /> Cascading Soft-Delete Approvals &amp; Audit Trail
          </h2>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
            Review, approve, or reject field asset deletion requests escalated to your supervisor role.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={fetchDeletions}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} className={isLoading ? "spin-icon" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "0 24px", display: "flex", gap: 8 }}>
        <button
          onClick={() => setActiveTab("pending")}
          style={{
            padding: "12px 16px", border: "none", borderBottom: activeTab === "pending" ? "3px solid #dc2626" : "3px solid transparent",
            background: "none", cursor: "pointer", fontSize: 12, fontWeight: 800,
            color: activeTab === "pending" ? "#dc2626" : "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6
          }}
        >
          <span>⏳ Pending Approvals</span>
          <span style={{ background: pendingList.length > 0 ? "rgba(220,38,38,0.15)" : "var(--bg-app)", color: pendingList.length > 0 ? "#dc2626" : "var(--text-muted)", padding: "2px 8px", borderRadius: 10, fontSize: 10 }}>
            {pendingList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          style={{
            padding: "12px 16px", border: "none", borderBottom: activeTab === "history" ? "3px solid #006633" : "3px solid transparent",
            background: "none", cursor: "pointer", fontSize: 12, fontWeight: 800,
            color: activeTab === "history" ? "#006633" : "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6
          }}
        >
          <span>📜 Audit History</span>
          <span style={{ background: "var(--bg-app)", color: "var(--text-muted)", padding: "2px 8px", borderRadius: 10, fontSize: 10 }}>
            {historyList.length}
          </span>
        </button>
      </div>

      {/* Workspace */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240, color: "var(--text-muted)", fontSize: 12, flexDirection: "column", gap: 10 }}>
            <div style={{ width: 28, height: 28, border: "3px solid rgba(220,38,38,0.15)", borderTop: "3px solid #dc2626", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Loading approval queue...
          </div>
        ) : (activeTab === "pending" ? pendingList : historyList).length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)", background: "#fff", borderRadius: 12, border: "1px solid var(--border)" }}>
            <CheckCircle2 size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {activeTab === "pending" ? "No pending deletion requests" : "No deletion history recorded yet"}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {activeTab === "pending" ? "All field asset deletion requests in your scope have been reviewed." : "Reviewed deletion actions will appear here in the audit log."}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
            {(activeTab === "pending" ? pendingList : historyList).map(r => (
              <div
                key={r.id}
                style={{
                  background: "#fff", borderRadius: 12, border: "1px solid var(--border)", padding: 18,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", justifyContent: "space-between"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ background: r.status === "pending" ? "rgba(234,179,8,0.15)" : r.status === "approved" ? "rgba(220,38,38,0.1)" : "rgba(0,102,51,0.1)", color: r.status === "pending" ? "#d97706" : r.status === "approved" ? "#dc2626" : "#006633", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, textTransform: "uppercase" }}>
                      {r.status === "pending" ? "⏳ Pending Review" : r.status === "approved" ? "🗑 Approved (Soft Deleted)" : "✅ Rejected (Restored Active)"}
                    </span>
                    <span style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 600 }}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>

                  <h3 style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px 0" }}>{r.asset_name || r.survey_id}</h3>
                  <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginBottom: 12 }}>
                    Asset Category: <strong>{r.asset_category}</strong> · ID: <code style={{ fontSize: 10 }}>{r.survey_id}</code>
                  </div>

                  <div style={{ background: "var(--bg-app)", padding: 10, borderRadius: 8, fontSize: 11, marginBottom: 14 }}>
                    <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>
                      <strong>Requested By:</strong> {r.requested_by_name}
                    </div>
                    <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>
                      <strong>Escalated Approver Role:</strong> {ROLE_LABELS[r.assigned_approver_role]}
                    </div>
                    {r.province && <div style={{ color: "var(--text-muted)", fontSize: 10 }}>Location: {r.province} {r.district ? `· ${r.district}` : ""}</div>}
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)", fontStyle: "italic", color: "var(--text-primary)" }}>
                      "{r.reason || "No reason specified"}"
                    </div>
                  </div>
                </div>

                {r.status === "pending" ? (
                  <button
                    onClick={() => setSelectedRequest(r)}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#006633", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", width: "100%" }}
                  >
                    Review Request
                  </button>
                ) : (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-app)", padding: 8, borderRadius: 6, textAlign: "center" }}>
                    Reviewed by <strong>{r.reviewed_by_name}</strong> on {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : "—"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, maxWidth: 480, width: "100%", padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Review Soft-Delete Request</h3>
              <button onClick={() => setSelectedRequest(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ background: "var(--bg-app)", padding: 12, borderRadius: 8, fontSize: 11, marginBottom: 16 }}>
              <div><strong>Asset:</strong> {selectedRequest.asset_name || selectedRequest.survey_id}</div>
              <div><strong>Requested By:</strong> {selectedRequest.requested_by_name}</div>
              <div><strong>Reason:</strong> "{selectedRequest.reason}"</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Supervisor Review Notes (Optional)</label>
              <textarea
                rows={3}
                placeholder="Enter audit notes / approval justification..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                disabled={isSubmitting}
                onClick={() => handleReview("rejected")}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "#006633", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}
              >
                Reject (Restore Active)
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => handleReview("approved")}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}
              >
                Approve Soft-Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
