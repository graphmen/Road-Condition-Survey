import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zimbabwe Road Condition Survey Dashboard",
  description: "Central repository and telemetry management dashboard for the Department of Roads, Zimbabwe Ministry of Transport and Infrastructural Development.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#006633" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
