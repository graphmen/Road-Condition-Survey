"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Smartphone,
  ShieldCheck,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Share2,
  Sparkles,
} from "lucide-react";
import type { AppDownloadInfo } from "@/lib/appDownloadInfo";

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

type Props = {
  info: AppDownloadInfo | null;
  apkExists: boolean;
};

export default function DownloadPageClient({ info: initialInfo, apkExists: initialApkExists }: Props) {
  const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState<AppDownloadInfo | null>(initialInfo);
  const [apkExists, setApkExists] = useState(initialApkExists);

  // Fallback: fetch release info from static CDN if server bundle was stale
  useEffect(() => {
    if (initialInfo?.versionName) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/downloads/app-info.json?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as AppDownloadInfo;
        if (cancelled) return;
        setInfo(data);
        const head = await fetch(`/downloads/${data.fileName}?v=${data.versionCode}`, { method: "HEAD", cache: "no-store" });
        if (!cancelled) setApkExists(head.ok && data.available);
      } catch {
        /* keep server-provided state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialInfo?.versionName]);

  const canDownload = Boolean(info?.available && apkExists);
  const apkHref = info
    ? `/downloads/${info.fileName}?v=${info.versionCode}&t=${encodeURIComponent(info.releasedAt ?? "")}`
    : "#";

  const shareLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({
          title: `MOTID Road Survey v${info?.versionName ?? ""}`,
          text: "Download the MOTID Road Survey collector app",
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="dl-page">
      <header className="dl-header">
        <div className="dl-header-inner">
          <img src="/coat_of_arms.png" alt="Zimbabwe Coat of Arms" className="dl-coat" />
          <div>
            <div className="dl-kicker">Ministry of Transport &amp; Infrastructural Development</div>
            <div className="dl-brand">Department of Roads</div>
          </div>
        </div>
        <a href="/" className="dl-back">
          <ArrowLeft size={14} /> Dashboard
        </a>
      </header>

      <main className="dl-main">
        {info && (
          <section className="dl-release-banner" aria-label="Latest release">
            <Sparkles size={18} />
            <div>
              <strong>Latest release: v{info.versionName} (build {info.versionCode})</strong>
              <p>{info.changelog}</p>
            </div>
          </section>
        )}

        <section className="dl-hero">
          <div className="dl-hero-copy">
            <p className="dl-eyebrow">Field collector app</p>
            <h1>MOTID Road Survey</h1>
            <p className="dl-lead">
              Download the Android app used by survey collectors to record road condition
              data offline, then sync when you have network coverage.
            </p>

            {canDownload ? (
              <div className="dl-cta-row">
                <a className="dl-btn-primary" href={apkHref} download={info?.fileName}>
                  <Download size={18} />
                  Download APK · v{info!.versionName}
                </a>
                <button type="button" className="dl-btn-secondary" onClick={shareLink}>
                  <Share2 size={16} />
                  {copied ? "Link copied" : "Share link"}
                </button>
              </div>
            ) : (
              <div className="dl-status warn">
                <AlertTriangle size={16} />
                The APK is not published yet. Ask your administrator to upload the latest build
                to this page.
              </div>
            )}

            <div className="dl-cta-row" style={{ marginTop: 12 }}>
              <a className="dl-btn-secondary" href="/collector" target="_blank" rel="noopener noreferrer">
                <Smartphone size={16} />
                Preview collector app in browser
              </a>
            </div>

            <p className="dl-update-hint">
              Already installed? Download again to update — Android may reuse the filename, so tap
              the green button above (build {info?.versionCode ?? "—"}) rather than an old saved file.
            </p>

            <div className="dl-meta">
              <div>
                <span>Version</span>
                <strong>{info ? `v${info.versionName}` : "—"}</strong>
              </div>
              <div>
                <span>Build</span>
                <strong>{info?.versionCode ?? "—"}</strong>
              </div>
              <div>
                <span>Size</span>
                <strong>{formatSize(info?.sizeBytes ?? null)}</strong>
              </div>
              <div>
                <span>Released</span>
                <strong>{formatDate(info?.releasedAt ?? null)}</strong>
              </div>
              <div>
                <span>Requires</span>
                <strong>Android {info?.minAndroid ?? "7.0+"}</strong>
              </div>
            </div>
          </div>

          <div className="dl-hero-panel" aria-hidden="true">
            <div className="dl-phone">
              <Smartphone size={42} strokeWidth={1.5} />
              <div>Road Survey</div>
              <small>{info ? `v${info.versionName} · build ${info.versionCode}` : "Offline-first · GPS · Sync"}</small>
            </div>
          </div>
        </section>

        <section className="dl-training">
          <h2>Training venue login</h2>
          <p className="dl-section-lead">
            Use this shared account during Level 2 training on web and mobile. No password change required.
          </p>
          <div className="dl-training-card">
            <div className="dl-training-row">
              <span>Email</span>
              <strong>{info?.trainingLogin?.email ?? "training@transport.gov.zw"}</strong>
            </div>
            <div className="dl-training-row">
              <span>Password</span>
              <strong>{info?.trainingLogin?.password ?? "Training@ZimRoads2026!"}</strong>
            </div>
            <div className="dl-training-row">
              <span>Web dashboard</span>
              <strong>{info?.dashboardUrl ?? "Same URL as this download page (without /download)"}</strong>
            </div>
            <div className="dl-training-row">
              <span>Mobile app</span>
              <strong>Tap &quot;Use training account&quot; on the sign-in screen, or enter credentials above</strong>
            </div>
            <p className="dl-training-note">
              {info?.trainingLogin?.note ??
                "For authorised training only. Personal accounts will be issued after training."}
            </p>
          </div>
        </section>

        <section className="dl-steps">
          <h2>Install on your phone</h2>
          <p className="dl-section-lead">
            Open this page on your Android phone, then follow these steps.
          </p>
          <ol>
            <li>
              <span className="dl-step-num">1</span>
              <div>
                <strong>Download the APK</strong>
                <p>
                  Tap the green Download button above (v{info?.versionName ?? "latest"}, build{" "}
                  {info?.versionCode ?? "—"}). Save the file when prompted.
                </p>
              </div>
            </li>
            <li>
              <span className="dl-step-num">2</span>
              <div>
                <strong>Allow install from this browser</strong>
                <p>
                  Android may ask permission to install unknown apps. Open Settings → allow
                  installs for Chrome / your browser → return and tap Install.
                </p>
              </div>
            </li>
            <li>
              <span className="dl-step-num">3</span>
              <div>
                <strong>Sign in with the training account</strong>
                <p>
                  Open the app and tap <strong>Use training account</strong>, or enter the training email and
                  password shown above. Grant location permission when prompted.
                </p>
              </div>
            </li>
            <li>
              <span className="dl-step-num">4</span>
              <div>
                <strong>Start collecting</strong>
                <p>
                  Dual carriageway: record each segment, fill attributes, queue Road 1 anytime, then End Road 1
                  for Road 2. If sync fails, confirm Server URL in Settings matches the dashboard address.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="dl-cards">
          <article>
            <Wifi size={20} />
            <h3>Works offline</h3>
            <p>Surveys are saved on the phone and sync when you reconnect.</p>
          </article>
          <article>
            <ShieldCheck size={20} />
            <h3>Official MOTID app</h3>
            <p>Package ID: {info?.packageId ?? "zw.gov.motid.roadsurvey"}</p>
          </article>
          <article>
            <CheckCircle2 size={20} />
            <h3>What&apos;s new</h3>
            <p>
              {info?.changelog ??
                "Sealed roads, gravel roads, bridges, culverts, signs, and other roadside assets."}
            </p>
          </article>
        </section>
      </main>

      <footer className="dl-footer">
        Republic of Zimbabwe · Department of Roads · For authorised field collectors only
      </footer>
    </div>
  );
}
