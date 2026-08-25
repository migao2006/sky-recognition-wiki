import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "光遇帳號整理",
  description:
    "整理 Sky 光遇帳號的季節、衣櫃、綁定與資源，並提供估價與匯出。",
  openGraph: {
    title: "光遇帳號整理",
    description: "一頁完成季節、衣櫃、綁定、估價與匯出。",
    images: ["https://sky-recognition-wiki.vercel.app/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "光遇帳號整理",
    description: "一頁完成季節、衣櫃、綁定、估價與匯出。",
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
