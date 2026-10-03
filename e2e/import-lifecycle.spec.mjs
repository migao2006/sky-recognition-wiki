import { expect, test } from "@playwright/test";
import { giftHtml, webarchiveFixture } from "../tests/helpers/webarchive-fixture.mjs";

const backup = name => ({
  format: "sky-recognition-wiki", version: 2,
  account: { name, accountType: "有翼" }, bindings: {}, owned: [],
});

async function prepare(page) {
  await page.addInitScript(() => {
    const readText = File.prototype.text;
    File.prototype.text = function () {
      if (this.name !== "slow.json") return readText.call(this);
      window.pendingImport = true;
      return new Promise(resolve => {
        window.finishImport = async () => {
          resolve(await readText.call(this));
          window.pendingImport = false;
        };
      });
    };
  });
  await page.goto("/");
  await expect(page.locator("main[data-hydration-ready='true']")).toBeVisible();
  await page.getByText("更多匯出方式").click();
}

async function upload(page, name, accountName) {
  await page.getByLabel("匯入 JSON 檔案").setInputFiles({
    name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup(accountName))),
  });
}

test("leaving the account step invalidates an unfinished import", async ({ page }) => {
  await prepare(page);
  await page.getByLabel("帳號名稱").fill("保留目前帳號");
  await upload(page, "slow.json", "不可回寫的舊結果");
  await expect.poll(() => page.evaluate(() => window.pendingImport)).toBe(true);
  await page.getByRole("button", { name: "下一步：選擇物品" }).click();
  await expect(page.getByRole("heading", { name: "選擇物品" })).toBeVisible();
  await page.evaluate(() => window.finishImport());
  await page.getByRole("button", { name: "返回帳號資料" }).click();
  await expect(page.getByLabel("帳號名稱")).toHaveValue("保留目前帳號");
  await expect(page.getByText(/已匯入/)).toHaveCount(0);
});

test("a newer file wins even if the previous file completes later", async ({ page }) => {
  await prepare(page);
  await upload(page, "slow.json", "舊檔案");
  await expect.poll(() => page.evaluate(() => window.pendingImport)).toBe(true);
  await upload(page, "new.json", "新檔案");
  await expect(page.getByLabel("帳號名稱")).toHaveValue("新檔案");
  await page.evaluate(() => window.finishImport());
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.reload();
  await expect(page.getByLabel("帳號名稱")).toHaveValue("新檔案");
});

test("every selection entry resets confirmation while draft and v4 backup restoration preserve it", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.locator("main[data-hydration-ready='true']")).toBeVisible();
  const enterCloset = () => page.getByRole("button", { name: "下一步：選擇物品" }).click();
  const back = () => page.getByRole("button", { name: "返回帳號資料" }).click();
  const confirmed = page.getByRole("checkbox", { name: /已逐項確認完整衣櫃/ });
  await enterCloset();
  await confirmed.check();
  await page.locator(".grid button").first().click();
  await expect(confirmed).not.toBeChecked();
  await confirmed.check();
  await back();
  await page.locator(".season-picker summary").click();
  await page.locator(".season-ultimate-items button").first().click();
  await enterCloset();
  await expect(confirmed).not.toBeChecked();
  await confirmed.check();
  await back();
  await page.locator(".quick-select summary").click();
  await page.locator(".preset-grid").getByRole("button", { name: /Nintendo/ }).click();
  await enterCloset();
  await expect(confirmed).not.toBeChecked();
  await confirmed.check();
  await back();
  await page.getByText("更多匯出方式").click();
  await page.getByLabel("匯入禮包網頁封存檔").setInputFiles({
    name: "selection.webarchive", mimeType: "application/x-webarchive",
    buffer: webarchiveFixture(giftHtml(["CharSkyKid_Horn_KizunaAi"])),
  });
  await page.getByRole("button", { name: "確認追加 1 件" }).click();
  await enterCloset();
  await expect(confirmed).not.toBeChecked();
  await confirmed.check();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.reload();
  await expect(page.locator("main[data-hydration-ready='true']")).toBeVisible();
  await enterCloset();
  await expect(confirmed).toBeChecked();
  await back();
  await page.getByText("更多匯出方式").click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出 JSON" }).click();
  const stream = await (await downloaded).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  expect(JSON.parse(buffer).account.wardrobeConfirmed).toBe(true);
  await enterCloset();
  await page.getByRole("button", { name: "前往估價" }).click();
  await page.getByRole("button", { name: "清除已選物品" }).click();
  await page.getByRole("button", { name: "返回衣櫃", exact: true }).click();
  await expect(confirmed).not.toBeChecked();
  await back();
  await page.getByText("更多匯出方式").click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByLabel("匯入 JSON 檔案").setInputFiles({ name: "restored.json", mimeType: "application/json", buffer });
  await expect(page.getByText(/已匯入/)).toBeVisible();
  await enterCloset();
  await expect(confirmed).toBeChecked();
});
