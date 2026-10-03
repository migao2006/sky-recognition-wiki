import { expect, test } from "@playwright/test";
import { giftHtml, webarchiveFixture } from "../tests/helpers/webarchive-fixture.mjs";
import { readFile } from "node:fs/promises";

test("previews the complete supported mapping without dropping bundle members", async ({ page }) => {
  const mapping = JSON.parse(await readFile(new URL("../app/sky-info-item-guids.json", import.meta.url), "utf8"));
  await page.goto("/");
  await expect(page.locator("main[data-hydration-ready='true']")).toBeVisible();
  await page.getByText("更多匯出方式").click();
  await page.getByLabel("匯入禮包網頁封存檔").setInputFiles({
    name: "catalog.webarchive", mimeType: "application/x-webarchive",
    buffer: webarchiveFixture(giftHtml(Object.keys(mapping))),
  });
  const preview = page.getByRole("region", { name: "禮包匯入預覽" });
  await expect(preview).toContainText("可辨識 209 件 · 新增 209 件");
  await expect(preview.getByText(/待確認/)).toHaveCount(0);
  await page.getByRole("button", { name: "確認追加 209 件" }).click();
  await expect(preview).toHaveCount(0);
});

test("archive import previews, appends, deduplicates and never executes archived content", async ({ page }) => {
  const requests = [];
  page.on("request", request => { if (request.url().includes("invalid.example")) requests.push(request.url()); });
  await page.goto("/");
  await expect(page.locator("main[data-hydration-ready='true']")).toBeVisible();
  await page.getByLabel("帳號名稱").fill("封存測試");
  await page.getByText("更多匯出方式").click();
  const upload = async html => page.getByLabel("匯入禮包網頁封存檔").setInputFiles({
    name: "test.webarchive", mimeType: "application/x-webarchive", buffer: webarchiveFixture(html),
  });
  const first = "CharSkyKid_Horn_KizunaAi";
  await upload(giftHtml([first]));
  await expect(page.getByRole("region", { name: "禮包匯入預覽" })).toContainText("新增 1 件");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await upload(giftHtml([first, first, "CharSkyKid_Unknown"]) + '<script>window.archiveExecuted=true</script><iframe src="https://invalid.example/frame"></iframe>');
  await expect(page.getByRole("region", { name: "禮包匯入預覽" })).toContainText("待確認 1 項");
  await page.getByRole("button", { name: "確認追加 1 件" }).click();
  await upload(giftHtml([first, "CharSkyKid_Wing_KizunaAi_Pink"]));
  await expect(page.getByRole("region", { name: "禮包匯入預覽" })).toContainText("新增 1 件 · 已有 1 件");
  await page.getByRole("button", { name: "確認追加 1 件" }).click();
  await expect(page.getByLabel("帳號名稱")).toHaveValue("封存測試");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.reload();
  await page.getByText("更多匯出方式").click();
  await upload(giftHtml([first, "CharSkyKid_Wing_KizunaAi_Pink"]));
  await expect(page.getByRole("button", { name: "確認追加 0 件" })).toBeDisabled();
  await upload(giftHtml([first], 2));
  await expect(page.getByText("禮包清單不完整，請等查詢結果全部顯示後重新儲存", { exact: true })).toBeVisible();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => window.archiveExecuted)).toBeUndefined();
});
