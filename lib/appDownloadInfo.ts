import fs from "fs";
import path from "path";

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

export function getAppDownloadInfo(): AppDownloadInfo | null {
  try {
    const infoPath = path.join(process.cwd(), "public", "downloads", "app-info.json");
    if (!fs.existsSync(infoPath)) return null;
    return JSON.parse(fs.readFileSync(infoPath, "utf8")) as AppDownloadInfo;
  } catch {
    return null;
  }
}

export function apkFileExists(info: AppDownloadInfo): boolean {
  try {
    const apkPath = path.join(process.cwd(), "public", "downloads", info.fileName);
    return fs.existsSync(apkPath);
  } catch {
    return false;
  }
}
