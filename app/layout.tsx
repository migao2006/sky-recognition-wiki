import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "光遇帳號整理｜衣櫃與估價",
  description:
    "整理 Sky 光遇的季節、衣櫃、綁定與資源，查看參考價格並匯出圖片。",
  openGraph: {
    title: "光遇帳號整理｜衣櫃與估價",
    description: "整理帳號資料，查看參考中位價與價格區間。",
    images: ["https://sky-recognition-wiki.vercel.app/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "光遇帳號整理｜衣櫃與估價",
    description: "整理帳號資料，查看參考中位價與價格區間。",
    images: ["https://sky-recognition-wiki.vercel.app/og.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#04060c",
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
