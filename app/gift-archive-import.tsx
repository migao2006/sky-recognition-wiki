"use client";

import { useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { useImportGeneration } from "./use-import-generation";
import type { AccountRuntime } from "./use-organizer-runtime";
import type { GiftArchivePreview } from "./sky-info-import";

type Props = {
  runtime: AccountRuntime;
  owned: ReadonlySet<string>;
  setOwned: Dispatch<SetStateAction<Set<string>>>;
  setNotice: Dispatch<SetStateAction<string>>;
};

export function GiftArchiveImport({ runtime, owned, setOwned, setNotice }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const generationRef = useImportGeneration();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<(GiftArchivePreview & { names: Record<string, string> }) | null>(null);
  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const current = ++generationRef.current;
    setPreview(null);
    setBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith(".webarchive")) throw new Error("請選擇 .webarchive 網頁封存檔");
      const { readWebarchive, WEBARCHIVE_MAX_BYTES } = await import("./webarchive");
      if (file.size > WEBARCHIVE_MAX_BYTES) throw new Error("封存檔不可超過 20 MB");
      const [buffer, catalog, parser] = await Promise.all([
        file.arrayBuffer(), runtime.loadCatalog(), import("./sky-info-import"),
      ]);
      if (generationRef.current !== current) return;
      const result = parser.parseGiftArchiveHtml(readWebarchive(new Uint8Array(buffer)), catalog.validItemGuids);
      const names = Object.fromEntries(catalog.wikiItems.filter(x => result.guids.includes(x.guid)).map(x => [x.guid, catalog.zhItemName(x)]));
      setPreview({ ...result, names });
    } catch (error) {
      if (generationRef.current === current) setNotice(error instanceof Error ? error.message : "封存檔讀取失敗");
    } finally {
      if (generationRef.current === current) setBusy(false);
    }
  };
  const added = preview?.guids.filter(id => !owned.has(id)) ?? [];
  return <div className="gift-archive-import">
    <button type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? "讀取封存檔…" : "匯入網頁封存檔"}</button>
    <input ref={input} type="file" className="file-input" accept=".webarchive,application/x-webarchive" aria-label="匯入禮包網頁封存檔" onChange={read} />
    <small>Safari 禮包查詢結果 · 本機解析，只追加物品</small>
    {preview && <section aria-label="禮包匯入預覽" className="account-extra">
      <p>{preview.packages} 個禮包 · 可辨識 {preview.guids.length} 件 · 新增 {added.length} 件 · 已有 {preview.guids.length - added.length} 件</p>
      <p>不更動綁定、資源與原有物品；此清單不代表完整衣櫃。</p>
      <details><summary>查看物品</summary><ul>{preview.guids.map(id => <li key={id}>{preview.names[id]}{owned.has(id) ? "（已有）" : ""}</li>)}</ul></details>
      {preview.unknown.length > 0 && <details open><summary>待確認 {preview.unknown.length} 項（不會加入）</summary><ul>{preview.unknown.map(name => <li key={name}>{name}</li>)}</ul></details>}
      <div className="export-tools">
        <button type="button" disabled={!added.length} onClick={() => {
          setOwned(previous => new Set([...previous, ...preview.guids]));
          setNotice(`已追加 ${added.length} 件禮包物品；待確認 ${preview.unknown.length} 項`);
          setPreview(null);
        }}>確認追加 {added.length} 件</button>
        <button type="button" onClick={() => setPreview(null)}>取消</button>
      </div>
    </section>}
  </div>;
}
