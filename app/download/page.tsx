import type { Metadata } from "next";
import DownloadPageClient from "./DownloadPageClient";
import { apkFileExists, getAppDownloadInfo } from "@/lib/appDownloadInfo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const info = getAppDownloadInfo();
  const version = info?.versionName ?? "latest";
  return {
    title: `Download MOTID Road Survey v${version}`,
    description: `Download the official Android APK (v${version}) for MOTID Road Survey field collectors.`,
  };
}

export default function DownloadPage() {
  const info = getAppDownloadInfo();
  const apkExists = info ? apkFileExists(info) : false;

  return <DownloadPageClient info={info} apkExists={apkExists} />;
}
