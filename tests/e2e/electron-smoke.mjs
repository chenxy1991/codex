import assert from "node:assert/strict";
import { _electron as electron } from "playwright";

const app = await electron.launch({ args: ["."] });

try {
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");

  assert.equal(await window.title(), "番茄钟");
  await window.getByTestId("time").waitFor();
  assert.equal((await window.getByTestId("time").textContent())?.trim(), "25:00");
  assert.equal((await window.getByTestId("start-pause").textContent())?.trim(), "开始");
} finally {
  await app.close();
}
