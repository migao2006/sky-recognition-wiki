import { expect, test } from "@playwright/test";

test("supports the essential mobile organizer flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "帳號資料" })).toBeVisible();

  await page.getByLabel("帳號名稱").fill("手機測試帳號");
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByLabel("帳號名稱")).toHaveValue("手機測試帳號");

  await page.getByRole("button", { name: "下一步：選擇物品" }).click();
  await expect(page.getByRole("heading", { name: "選擇物品" })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: /篩選/ }).first().click();
  const filterDialog = page.getByRole("dialog", { name: "篩選物品" });
  await expect(filterDialog).toBeVisible();
  await page.evaluate(() => {
    const probe = document.createElement("button");
    probe.id = "outside-focus-probe";
    document.body.append(probe);
    probe.focus();
  });
  await expect(page.locator("#outside-focus-probe")).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await filterDialog.evaluate((dialog) =>
      dialog.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.locator("#outside-focus-probe").evaluate((probe) => probe.remove());
  await page.keyboard.press("Escape");
  await expect(filterDialog).toBeHidden();

  const firstItem = page.locator(".grid button").first();
  await expect(firstItem).toBeVisible();
  await firstItem.click();
  await expect(page.getByText(/已選 1/)).toBeVisible();

  await page.getByRole("button", { name: "前往估價" }).click();
  await expect(page.getByRole("heading", { name: "估價與匯出" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "複製出售文案" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "legacy-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "sky-recognition-wiki",
      version: 2,
      account: {
        name: "舊版備份",
        accountType: "有翼",
        bindingNote: "前號不出",
        notes: "交易前請先核對",
      },
      bindings: {},
      owned: ["instrument-harp", "unknown-guid"],
    })),
  });
  await expect(page.getByText("已匯入 0 件、遷移 1 件、略過 1 件")).toBeVisible();

  const backupInput = page.locator('input[type="file"]');
  await backupInput.setInputFiles({
    name: "future-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "sky-recognition-wiki",
      version: 999,
      account: {},
      bindings: {},
      owned: [],
    })),
  });
  await expect(page.getByText("無法匯入：備份版本較新或不支援")).toBeVisible();
  await backupInput.setInputFiles({
    name: "invalid-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not-json"),
  });
  await expect(page.getByText("無法匯入：檔案格式不正確")).toBeVisible();

  await page.getByText("更多匯出方式").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "出售文案", exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const saleCopy = Buffer.concat(chunks).toString("utf8");
  expect(saleCopy).toContain("✦ 交易說明");
  expect(saleCopy).toContain("綁定說明｜前號不出");
  expect(saleCopy).toContain("交易前須知｜交易前請先核對");
});
