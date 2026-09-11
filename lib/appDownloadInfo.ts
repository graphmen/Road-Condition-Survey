import appInfoData from "../public/downloads/app-info.json";

export type AppDownloadInfo = {
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
  trainingLogin?: {
    email: string;
    password: string;
    role: string;
    note: string;
  };
  dashboardUrl?: string;
};

/** Bundled at build time — works on Vercel (serverless has no fs access to public/). */
export function getAppDownloadInfo(): AppDownloadInfo {
  return appInfoData as AppDownloadInfo;
}

/** APK is published alongside app-info.json in public/downloads on every release. */
export function apkIsPublished(info: AppDownloadInfo): boolean {
  return Boolean(info.available && info.fileName && info.versionCode > 0);
}
