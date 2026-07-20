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
} from "lucide-react";

type AppInfo = {
  appName: string;
  packageId: string;
  versionName: string;
  versionCode: number;
  fileName: string;
  minAndroid: string;
  releasedAt: string | null;
  sizeBytes: number | null;
  available: boolean;
  changelog?: string;
};

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function DownloadPage() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [apkExists, setApkExists] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/downloads/app-info.json", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load app info");
        const data: AppInfo = await res.json();
        if (cancelled) return;
        setInfo(data);

        const head = await fetch(`/downloads/${data.fileName}`, { method: "HEAD", cache: "no-store" });
        if (!cancelled) setApkExists(head.ok);
      } catch {
        if (!cancelled) {
          setInfo(null);
          setApkExists(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const canDownload = Boolean(info?.available && apkExists);
  const apkHref = info ? `/downloads/${info.fileName}` : "#";

  const shareLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({
          title: "MOTID Road Survey App",
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
        <section className="dl-hero">
          <div className="dl-hero-copy">
            <p className="dl-eyebrow">Field collector app</p>
            <h1>MOTID Road Survey</h1>
            <p className="dl-lead">
              Download the Android app used by survey collectors to record road condition
              data offline, then sync when you have network coverage.
            </p>

            {loading ? (
              <div className="dl-status muted">Checking latest build…</div>
            ) : canDownload ? (
              <div className="dl-cta-row">
                <a className="dl-btn-primary" href={apkHref} download>
                  <Download size={18} />
                  Download APK
                  {info?.versionName ? ` · v${info.versionName}` : ""}
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

            <div className="dl-meta">
              <div>
                <span>Version</span>
                <strong>{info ? `v${info.versionName}` : "—"}</strong>
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
              <small>Offline-first · GPS · Sync</small>
            </div>
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
                <p>Tap the green Download button above. Save the file when prompted.</p>
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
                <strong>Open MOTID Road Survey</strong>
                <p>
                  After install, open the app, grant location permission, and you are ready to
                  collect in the field.
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
            <h3>What&apos;s included</h3>
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
