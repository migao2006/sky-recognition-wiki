import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "光遇辨識學習 Wiki",
  description: "依遊戲內五座衣櫃順序整理，可搜尋季節、活動與估號分類的 Sky 光遇物品圖鑑。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
