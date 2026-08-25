import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "光遇帳號整理",
  description:
    "集中整理 Sky 光遇帳號的季節、衣櫃、綁定與資源資料，並提供估價與匯出工具。",
  openGraph: {
    title: "光遇帳號整理",
    description: "季節、衣櫃、綁定、估價與匯出集中在同一頁完成。",
    images: ["https://sky-recognition-wiki.vercel.app/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "光遇帳號整理",
    description: "季節、衣櫃、綁定、估價與匯出集中在同一頁完成。",
    images: ["https://sky-recognition-wiki.vercel.app/og.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f8f1e8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
