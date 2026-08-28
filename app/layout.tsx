import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sky-recognition-wiki.vercel.app"),
  title: "光遇帳號整理｜衣櫃與估價",
  description:
    "整理 Sky 光遇的季節、衣櫃、綁定與資源，查看參考價格並匯出圖片。",
  openGraph: {
    title: "光遇帳號整理｜衣櫃與估價",
    description: "整理帳號資料，查看參考中位價與價格區間。",
    images: [
      {
        url: "/og-starfield.png",
        width: 1734,
        height: 907,
        alt: "光遇帳號整理｜衣櫃・估價・匯出",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "光遇帳號整理｜衣櫃與估價",
    description: "整理帳號資料，查看參考中位價與價格區間。",
    images: ["/og-starfield.png"],
  },
  appleWebApp: {
    capable: true,
    title: "光遇帳號整理",
    statusBarStyle: "black-translucent",
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
