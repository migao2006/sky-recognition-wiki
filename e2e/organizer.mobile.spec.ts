import { expect, test } from "@playwright/test";

test("supports the complete mobile organizer flow without a valuation API", async ({ page }) => {
  let valuationCalls = 0;
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      value: async ({ text }: ShareData) => {
        window.sessionStorage.setItem("shared-account-summary", text ?? "");
      },
    });
  });
  await page.route("**/api/valuation", (route) => {
    valuationCalls += 1;
    return route.abort();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "帳號資料" })).toBeVisible();
  await expect(page.locator("main[data-hydration-ready='true']")).toBeVisible();

  await page.getByLabel("帳號名稱").fill("手機測試帳號");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.reload();
  await expect(page.getByLabel("帳號名稱")).toHaveValue("手機測試帳號");
  await page.locator(".binding-section summary").click();
  await page.getByLabel("已確認以上綁定狀態").check();

  await page.getByRole("button", { name: "下一步：選擇物品" }).click();
  await expect(page.getByRole("heading", { name: "選擇物品" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /篩選/ }).first().click();
  const filterDialog = page.getByRole("dialog", { name: "篩選物品" });
  await expect(filterDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filterDialog).toBeHidden();

  await page.getByRole("button", { name: "禮包限定" }).click();
  const firstItem = page.locator(".grid button").first();
  await expect(firstItem).toHaveAccessibleName(/^選取：.+/);
  await firstItem.click();
  await expect(firstItem).toHaveAccessibleName(/^取消選取：.+/);
  await page.getByRole("button", { name: "前往整理" }).click();

  await expect(page.getByRole("heading", { name: "整理與匯出" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "分享摘要" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重點收藏" })).toBeVisible();
  await expect(page.locator(".output-metrics")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("估價");
  expect(valuationCalls).toBe(0);

  await page.getByRole("button", { name: "分享摘要" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => sessionStorage.getItem("shared-account-summary")),
    )
    .not.toBeNull();
  const shared =
    (await page.evaluate(() =>
      sessionStorage.getItem("shared-account-summary"),
    )) ?? "";
  expect(shared).not.toContain("參考估價");
  expect(shared).not.toMatch(/NT\$/u);

  await page.evaluate(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      const values = JSON.parse(sessionStorage.getItem("canvas-text") ?? "[]");
      values.push(text);
      sessionStorage.setItem("canvas-text", JSON.stringify(values));
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    };
  });
  const imageDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下載圖片", exact: true }).click();
  await imageDownload;
  const canvasText = await page.evaluate(() => sessionStorage.getItem("canvas-text") ?? "");
  expect(canvasText).toContain("帳號收藏摘要");
  expect(canvasText).not.toContain("估價");
});

test("imports and exports account backups from the first step", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main[data-hydration-ready='true']")).toBeVisible();
  await page.getByLabel("帳號名稱").fill("目前帳號");
  await page.getByText("更多匯出方式").click();

  const legacyBackup = {
    format: "sky-recognition-wiki",
    version: 2,
    account: { name: "舊版備份", accountType: "有翼", bindingNote: "前號不出", notes: "交易前請先核對" },
    bindings: {},
    owned: ["instrument-harp", "unknown-guid"],
  };
  const backupInput = page.getByLabel("匯入 JSON 檔案");
  page.once("dialog", (dialog) => dialog.accept());
  await backupInput.setInputFiles({
    name: "legacy-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacyBackup)),
  });
  await expect(page.getByText("已匯入 0 件、遷移 1 件、略過 1 件")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出 JSON" }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(exported.version).toBe(4);
  expect(exported.account.name).toBe("舊版備份");
  expect(exported.account.wardrobeConfirmed).toBe(false);
  expect(exported.owned).toHaveLength(1);
});
