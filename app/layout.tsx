import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "光遇辨識學習 Wiki",
  description: "可搜尋、比較與練習的 Sky 光遇物品視覺圖鑑。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
