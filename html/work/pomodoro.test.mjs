import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { chromium } from "/Users/chenxy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const pageUrl = pathToFileURL(new URL("../outputs/index.html", import.meta.url).pathname).href;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();

try {
  await page.goto(pageUrl);

  await assertText(page, "time", "25:00");
  await assertText(page, "status", "准备开始专注。");
  await assertText(page, "completed-count", "0");
  assert.equal(await page.getByTestId("theme-toggle").inputValue(), "light");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");

  await page.getByTestId("theme-toggle").selectOption("dark");
  assert.equal(await page.getByTestId("theme-toggle").inputValue(), "dark");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");

  await page.getByTestId("task-input").fill("写完番茄钟测试");
  await page.getByTestId("add-task").click();
  await assertText(page, "focus-task", "写完番茄钟测试");
  assert.equal(await page.locator(".task-item").count(), 1);

  await page.getByTestId("setting-work").fill("1");
  await assertText(page, "time", "01:00");

  await page.getByTestId("start-pause").click();
  await page.evaluate(() => window.__pomodoroApp.tick(5));
  await assertText(page, "time", "00:55");
  await assertText(page, "start-pause", "暂停");

  await page.evaluate(() => window.__pomodoroApp.tick(55));
  await assertText(page, "time", "05:00");
  await assertText(page, "completed-count", "1");
  await assertText(page, "focus-minutes", "1");
  await assertText(page, "start-pause", "开始");
  assert.equal(await page.getByTestId("mode-short").getAttribute("aria-pressed"), "true");

  await page.locator(".task-toggle").click();
  await assertText(page, "done-count", "1");
  await assertText(page, "focus-task", "还没有任务，添加一个要完成的小目标。");

  await page.getByTestId("mode-work").click();
  await assertText(page, "time", "01:00");
  await page.getByTestId("skip").click();
  await assertText(page, "completed-count", "1");
  assert.equal(await page.getByTestId("mode-short").getAttribute("aria-pressed"), "true");

  console.log("Pomodoro tests passed");
} finally {
  await browser.close();
}

async function assertText(page, testId, expected) {
  await page.waitForFunction(
    ({ testId, expected }) => {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      return element?.textContent?.trim() === expected;
    },
    { testId, expected }
  );
  assert.equal((await page.getByTestId(testId).textContent()).trim(), expected);
}
