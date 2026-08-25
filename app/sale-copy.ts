type SaleCopyInput = {
  accountName: string;
  accountType: string;
  selectedCount: number;
  earliestSeason: string;
  seasonNames: string[];
  graduationStatus: string[];
  bindingDetails: string[];
  transferable: string;
  swappable: string;
  kept: string;
  issues: string;
  resources: {
    candles: string;
    hearts: string;
    ascended: string;
    passes: string;
  };
  ultimates: string[];
  uniqueEvents: string[];
  otherPackages: string[];
  packageItemCount: number;
  notes: string;
};

const divider = "⸻";
const placeholder = "［請填寫］";
const inlineList = (items: string[], empty = placeholder) =>
  items.length ? items.join("⸝") : empty;
const seasonRows = (items: string[]) =>
  items.length
    ? Array.from({ length: Math.ceil(items.length / 5) }, (_, index) =>
        items
          .slice(index * 5, index * 5 + 5)
          .map((item) => `［${item}］`)
          .join("┊"),
      )
    : ["［尚未選取季節物品］"];

export const buildSaleCopy = (data: SaleCopyInput) => {
  const position = `${data.earliestSeason || "起季待填"}｜${data.accountType}｜已選取 ${data.selectedCount} 件｜付費物品 ${data.packageItemCount} 件`;
  const summaryHighlights =
    data.ultimates.slice(0, 6).join("、") || "核心物品待補";
  return [
    `▍${data.accountName || "光遇帳號出售"}`,
    "",
    "▍帳號概況",
    "",
    position,
    "",
    divider,
    "",
    "♤ › 季節與衣櫃",
    "",
    `起季：${data.earliestSeason ? `${data.earliestSeason}（依已選物品推定，請確認）` : placeholder}`,
    "",
    "季節：",
    ...seasonRows(data.seasonNames),
    "",
    `持有季卡：${placeholder}`,
    "",
    `畢業：${inlineList(data.graduationStatus, "尚未選取完整畢業禮")}`,
    "",
    `斷季／缺季：${placeholder}`,
    "",
    `復刻：${placeholder}`,
    "",
    `地圖：${placeholder}`,
    "",
    divider,
    "",
    "♡ › 綁定／帳號安全",
    "",
    `可出：${data.transferable}`,
    `可換：${data.swappable}`,
    `不出：${data.kept}`,
    `遺失／異常：${data.issues}`,
    "",
    "各綁定狀態：",
    ...data.bindingDetails.map((line) => `* ${line}`),
    "",
    `前任帳號數：${placeholder}`,
    `是否可聯絡前號：${placeholder}`,
    `是否有卡登入紀錄：${placeholder}`,
    `是否有退款／刷退紀錄：${placeholder}`,
    `售後安排：${placeholder}`,
    "",
    divider,
    "",
    "♧ › 價格／交易",
    "",
    `售價：NT$${placeholder}`,
    "［包仲介／不包仲介］",
    "［可刀／小刀／不刀］",
    `交易方式：${placeholder}`,
    "",
    divider,
    "",
    "◇ › 重點特色",
    "",
    "老季／畢業禮：",
    inlineList(data.ultimates),
    "",
    "絕版／聯動：",
    inlineList(data.uniqueEvents),
    "",
    divider,
    "",
    "ᴜɴɪǫᴜᴇ ᴇᴠᴇɴᴛs ╻",
    "",
    inlineList(data.uniqueEvents),
    "",
    divider,
    "",
    "ᴏᴛʜᴇʀs ╻",
    "",
    inlineList(data.otherPackages),
    "",
    `已選取付費物品：約 ${data.packageItemCount} 件（請人工確認套組數）`,
    "",
    divider,
    "",
    "☆ › 徽章",
    "",
    `徽章總數：${placeholder}`,
    `實體同出：${placeholder}`,
    `僅帳號數據／無實體：${placeholder}`,
    `徽章狀況：${placeholder}`,
    "",
    divider,
    "",
    "⭔ › 資源",
    "",
    `白蠟：${data.resources.candles || "0"}`,
    `愛心：${data.resources.hearts || "0"}`,
    `昇華蠟燭：${data.resources.ascended || "0"}`,
    `季蠟／活動代幣：${placeholder}`,
    `副卡：${data.resources.passes || "0"} 張`,
    `售出前：${placeholder}`,
    "",
    divider,
    "",
    "♢ › 其他加分項",
    "",
    placeholder,
    "",
    divider,
    "",
    "⚠ › 交易前須說明",
    "",
    data.issues === "無" && !data.notes
      ? placeholder
      : [data.issues !== "無" ? `綁定異常：${data.issues}` : "", data.notes]
          .filter(Boolean)
          .join("\n"),
    "",
    divider,
    "",
    "🎥 › 驗號建議",
    "",
    "以驗號影片為準，文案僅供參考。",
    "建議拍攝順序：季節畢業禮 → 衣櫃 → 禮包 → 聯動 → 徽章 → 貨幣資源 → 地圖進度 → 綁定頁面 → 帳號設定",
    "可提供：［完整錄屏／指定物品補拍／交易前即時驗號］",
    "",
    divider,
    "",
    "▍一句話總結",
    "",
    `${data.earliestSeason || "起季待填"}｜${data.accountType}｜付費物品 ${data.packageItemCount} 件｜${summaryHighlights}｜可出 ${data.transferable}｜不出 ${data.kept}`,
    "",
    "資料來源：SkyGame-Data、SkyGame-Planner、BWiki 中文清單",
  ];
};
