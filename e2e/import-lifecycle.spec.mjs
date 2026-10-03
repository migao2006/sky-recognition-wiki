import { expect, test } from "@playwright/test";

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
