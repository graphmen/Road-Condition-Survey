import { useRef, useState, type ChangeEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera as CameraIcon, ImagePlus, Trash2 } from "lucide-react";

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  label?: string;
  hint?: string;
};

/** Compress a data URL to keep drafts/sync payloads manageable. */
export async function compressDataUrl(dataUrl: string, maxWidth = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Capture one photo using the device camera.
 * Prefer getUserMedia (works in Capacitor Android WebView once CAMERA permission is granted),
 * fall back to a hidden file input with capture=environment.
 */
export async function capturePhotoNativeOrNull(
  fileInputFallback?: HTMLInputElement | null
): Promise<string | null> {
  // Try live camera stream first (native WebView + modern browsers)
  if (typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
    try {
      return await captureViaGetUserMedia();
    } catch (e) {
      console.warn("getUserMedia capture failed, falling back:", e);
    }
  }
  if (fileInputFallback) {
    fileInputFallback.click();
  }
  return null;
}

function captureViaGetUserMedia(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    let stream: MediaStream | null = null;
    const overlay = document.createElement("div");
    overlay.setAttribute("data-photo-capture-overlay", "1");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99999",
      background: "#000",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
    });

    const video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.muted = true;
    Object.assign(video.style, {
      flex: "1",
      width: "100%",
      objectFit: "cover",
      background: "#000",
    });

    const bar = document.createElement("div");
    Object.assign(bar.style, {
      display: "flex",
      gap: "12px",
      padding: "16px",
      paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      background: "rgba(0,0,0,0.85)",
      justifyContent: "center",
      alignItems: "center",
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    Object.assign(cancelBtn.style, {
      flex: "1",
      height: "48px",
      borderRadius: "10px",
      border: "1px solid #444",
      background: "#222",
      color: "#fff",
      fontWeight: "700",
      fontSize: "14px",
    });

    const shutterBtn = document.createElement("button");
    shutterBtn.type = "button";
    shutterBtn.textContent = "Capture";
    Object.assign(shutterBtn.style, {
      flex: "1.4",
      height: "48px",
      borderRadius: "10px",
      border: "none",
      background: "#059669",
      color: "#fff",
      fontWeight: "800",
      fontSize: "14px",
    });

    const cleanup = () => {
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch { /* ignore */ }
      overlay.remove();
    };

    cancelBtn.onclick = () => {
      cleanup();
      reject(new Error("User cancelled photos"));
    };

    shutterBtn.onclick = async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const raw = canvas.toDataURL("image/jpeg", 0.85);
        cleanup();
        resolve(await compressDataUrl(raw));
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    bar.appendChild(cancelBtn);
    bar.appendChild(shutterBtn);
    overlay.appendChild(video);
    overlay.appendChild(bar);
    document.body.appendChild(overlay);

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

/**
 * Reliable multi-photo capture for survey forms:
 * - Native APK: getUserMedia live preview (fixes flaky WebView file-input)
 * - Always: file input fallback (gallery / system camera)
 */
export function PhotoCapture({
  photos,
  onChange,
  maxPhotos = 8,
  label = "Photos",
  hint,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canAdd = photos.length < maxPhotos;

  const addPhoto = async (dataUrl: string) => {
    const compressed = await compressDataUrl(dataUrl);
    onChange([...photos, compressed]);
  };

  const handleCapture = async () => {
    if (!canAdd || busy) return;
    setError("");
    setBusy(true);
    try {
      const dataUrl = await capturePhotoNativeOrNull(fileRef.current);
      if (dataUrl) await addPhoto(dataUrl);
    } catch (e: unknown) {
      const msg = (e as Error)?.message || "Camera failed";
      if (!/cancel|dismiss|User cancelled/i.test(msg)) {
        setError(msg);
        // Last resort: system picker
        try {
          fileRef.current?.click();
        } catch { /* ignore */ }
      }
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const remaining = maxPhotos - photos.length;
      const selected = Array.from(files).slice(0, remaining);
      const next = [...photos];
      for (const file of selected) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(file);
        });
        if (dataUrl) next.push(await compressDataUrl(dataUrl));
      }
      onChange(next);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Could not load image");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const removeAt = (idx: number) => {
    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div className="mobile-form-group">
      <label className="mobile-label">
        {label}{" "}
        <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>
          ({photos.length}/{maxPhotos})
        </span>
      </label>
      {hint && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "0 0 8px", lineHeight: 1.4 }}>
          {hint}
        </p>
      )}

      {photos.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginBottom: 10,
          }}
        >
          {photos.map((src, idx) => (
            <div
              key={`${idx}-${src.slice(0, 24)}`}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
                border: "1px solid var(--border-color)",
                background: "#111",
              }}
            >
              <img src={src} alt={`Photo ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(220,38,38,0.92)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                aria-label={`Remove photo ${idx + 1}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={handleCapture}
            disabled={busy}
            className="mobile-btn"
            style={{
              width: "100%",
              height: 48,
              gap: 8,
              fontSize: 12,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? (
              "Opening camera…"
            ) : (
              <>
                {photos.length === 0 ? <CameraIcon size={16} /> : <ImagePlus size={16} />}
                {photos.length === 0 ? "Take Photo" : "Add Another Photo"}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="mobile-btn mobile-btn-outline"
            style={{ width: "100%", height: 40, gap: 8, fontSize: 11 }}
          >
            Choose from Gallery
          </button>
        </div>
      )}

      {!canAdd && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "6px 0 0" }}>
          Maximum {maxPhotos} photos reached.
        </p>
      )}

      {error && (
        <p style={{ fontSize: 11, color: "#dc2626", margin: "6px 0 0" }}>{error}</p>
      )}

      {/* Hidden file input — gallery + system-camera fallback */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple={!Capacitor.isNativePlatform()}
        capture={Capacitor.isNativePlatform() ? undefined : "environment"}
        onChange={onFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
