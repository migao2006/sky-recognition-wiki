import { expect, test } from "@playwright/test";

test("supports the essential mobile organizer flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "帳號資料" })).toBeVisible();
  await expect(page.locator("main[data-hydration-ready='true']")).toBeVisible();

  await page.getByLabel("帳號名稱").fill("手機測試帳號");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...Array(window.localStorage.length).keys()].some((index) => {
          const value = window.localStorage.getItem(
            window.localStorage.key(index) ?? "",
          );
          return value?.includes("手機測試帳號") ?? false;
        }),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByLabel("帳號名稱")).toHaveValue("手機測試帳號");

  await page.getByText("更多匯出方式").click();
  await expect(page.getByRole("button", { name: "匯出 JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "匯入 JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "出售文案" })).toHaveCount(0);
  await page.locator(".binding-section summary").click();
  await page.getByLabel("已確認以上綁定狀態").check();

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
  await page.getByRole("button", { name: "季節畢業" }).click();

  const firstItem = page.locator(".grid button").first();
  await expect(firstItem).toBeVisible();
  await expect(firstItem).toHaveAccessibleName(/^選取：.+/);
  const firstIcon = firstItem.locator("img");
  await expect(firstIcon).toBeVisible();
  await firstIcon.dispatchEvent("error");
  await expect(firstItem.locator(".catalog-icon-fallback")).toBeVisible();
  await firstItem.click();
  await expect(firstItem).toHaveAccessibleName(/^取消選取：.+/);
  await expect(page.getByText(/已選 1/)).toBeVisible();

  await page.getByRole("button", { name: "前往估價" }).click();
  await expect(page.getByRole("heading", { name: "估價與匯出" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "分享摘要" })).toBeVisible();
  await expect(page.getByRole("button", { name: /出售文案/ })).toHaveCount(0);
  await expect(page.getByText("更多匯出方式")).toHaveCount(0);
  await expect(page.locator(".valuation-contributions")).toHaveCount(0);
  await expect(page.locator(".valuation-season-table")).toHaveCount(0);
  await page.getByText("查看全部季節價位").click();
  await expect(page.locator(".valuation-season-table")).toBeVisible();
  await page.getByText("估價依據").click();
  await expect(page.locator(".valuation-method p")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ text }: ShareData) => {
        window.sessionStorage.setItem("shared-account-summary", text ?? "");
      },
    });
  });
  await page.getByRole("button", { name: "分享摘要" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.sessionStorage.getItem("shared-account-summary"),
      ),
    )
    .toContain("✦");
});

test("imports and exports account backups from the first step", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "帳號資料" })).toBeVisible();
  await expect(page.locator("main[data-hydration-ready='true']")).toBeVisible();
  await page.getByLabel("帳號名稱").fill("目前帳號");
  await page.getByText("更多匯出方式").click();

  const legacyBackup = {
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
  };
  const backupInput = page.getByLabel("匯入 JSON 檔案");
  page.once("dialog", (dialog) => dialog.dismiss());
  await backupInput.setInputFiles({
    name: "legacy-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacyBackup)),
  });
  await expect(page.getByText("已取消匯入，原有資料未變更")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await backupInput.setInputFiles({
    name: "legacy-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacyBackup)),
  });
  await expect(page.getByText("已匯入 0 件、遷移 1 件、略過 1 件")).toBeVisible();

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

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出 JSON" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(exported.version).toBe(3);
  expect(exported.account.name).toBe("舊版備份");
  expect(exported.owned).toHaveLength(1);
});
