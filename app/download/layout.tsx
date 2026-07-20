import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download MOTID Road Survey App",
  description:
    "Download the official Android APK for MOTID Road Survey field collectors.",
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
