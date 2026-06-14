import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";

class ClassList {
  constructor(element) {
    this.element = element;
  }

  toggle(name, force) {
    const classes = new Set(this.element.className.split(/\s+/).filter(Boolean));
    const shouldAdd = force ?? !classes.has(name);
    if (shouldAdd) classes.add(name);
    else classes.delete(name);
    this.element.className = [...classes].join(" ");
  }
}

class Element {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, value)
    };
    this.classList = new ClassList(this);
    this.className = "";
    this.value = "";
    this.disabled = false;
    this.textContent = "";
  }

  set innerHTML(value) {
    this.children = [];
    this.textContent = value;
  }

  get innerHTML() {
    return this.textContent;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "class") this.className = String(value);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
      this.ownerDocument.register(this);
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
      this.ownerDocument.registerTree(child);
    }
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, target = this) {
    const event = {
      target,
      preventDefault() {},
      stopPropagation() {}
    };
    for (const listener of this.listeners.get(type) || []) listener(event);
  }

  click() {
    this.dispatch("click", this);
    let parent = this.parentElement;
    while (parent) {
      parent.dispatch("click", this);
      parent = parent.parentElement;
    }
  }

  focus() {}

  select() {}

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.ownerDocument.queryWithin(this, selector)[0] || null;
  }

  matches(selector) {
    if (selector === "[data-action]") return Boolean(this.dataset.action);
    if (selector === "[data-task-id]") return Boolean(this.dataset.taskId);
    return false;
  }
}

class Document {
  constructor() {
    this.elements = [];
    this.activeElement = null;
    this.documentElement = new Element("html", this);
    this.register(this.documentElement);
  }

  createElement(tagName) {
    const element = new Element(tagName, this);
    this.elements.push(element);
    return element;
  }

  register(element) {
    if (!this.elements.includes(element)) this.elements.push(element);
  }

  registerTree(element) {
    this.register(element);
    for (const child of element.children) this.registerTree(child);
  }

  querySelector(selector) {
    return this.queryAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    return this.queryAll(selector);
  }

  queryWithin(root, selector) {
    const descendants = [];
    const collect = (element) => {
      for (const child of element.children) {
        descendants.push(child);
        collect(child);
      }
    };
    collect(root);
    return descendants.filter((element) => this.matches(element, selector));
  }

  queryAll(selector) {
    return this.elements.filter((element) => this.matches(element, selector));
  }

  matches(element, selector) {
    const testId = selector.match(/^\[data-testid="(.+)"\]$/);
    if (testId) return element.dataset.testid === testId[1] || element.dataset.testId === testId[1];
    if (selector === "[data-mode]") return Boolean(element.dataset.mode);
    if (selector === "[data-task-id]") return Boolean(element.dataset.taskId);
    if (selector === "[data-action]") return Boolean(element.dataset.action);
    return false;
  }
}

const document = new Document();
const testIds = [
  "time",
  "status",
  "progress-ring",
  "start-pause",
  "reset",
  "skip",
  "cycle-label",
  "completed-count",
  "focus-minutes",
  "done-count",
  "focus-task",
  "setting-work",
  "setting-short",
  "setting-long",
  "theme-toggle",
  "task-form",
  "task-input",
  "task-list",
  "empty-tasks"
];

for (const id of testIds) {
  const tag = id === "theme-toggle"
    ? "select"
    : id.startsWith("setting") || id === "task-input"
      ? "input"
      : id === "task-list"
        ? "ul"
        : "div";
  const element = document.createElement(tag);
  element.setAttribute("data-testid", id);
}

for (const [id, mode] of [["mode-work", "work"], ["mode-short", "short"], ["mode-long", "long"]]) {
  const button = document.createElement("button");
  button.setAttribute("data-testid", id);
  button.dataset.mode = mode;
  document.register(button);
}

const storage = new Map();
const timers = new Map();
let timerId = 0;
const context = createContext({
  console,
  crypto: { randomUUID: () => `id-${Math.random()}` },
  document,
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  setInterval: (fn) => {
    timerId += 1;
    timers.set(timerId, fn);
    return timerId;
  },
  clearInterval: (id) => timers.delete(id),
  window: {}
});
context.window = context;

const html = readFileSync(new URL("../outputs/index.html", import.meta.url), "utf8");
const scriptContent = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(scriptContent, "index.html should contain an inline script");
new Script(scriptContent).runInContext(context);

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const dispatchInput = (id, value) => {
  const element = byTestId(id);
  element.value = value;
  element.dispatch("input", element);
};

assert.equal(byTestId("time").textContent, "25:00");
assert.equal(byTestId("status").textContent, "准备开始专注。");
assert.equal(byTestId("theme-toggle").value, "light");
assert.equal(document.documentElement.getAttribute("data-theme"), "light");

dispatchInput("theme-toggle", "dark");
byTestId("theme-toggle").dispatch("change", byTestId("theme-toggle"));
assert.equal(byTestId("theme-toggle").value, "dark");
assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
assert.equal(context.window.__pomodoroApp.state.theme, "dark");

dispatchInput("task-input", "写完番茄钟测试");
byTestId("task-form").dispatch("submit", byTestId("task-form"));
assert.equal(byTestId("focus-task").textContent, "写完番茄钟测试");
assert.equal(byTestId("task-list").children.length, 1);

dispatchInput("setting-work", "1");
assert.equal(byTestId("time").textContent, "01:00");

byTestId("start-pause").click();
context.window.__pomodoroApp.tick(5);
assert.equal(byTestId("time").textContent, "00:55");
assert.equal(byTestId("start-pause").textContent, "暂停");

context.window.__pomodoroApp.tick(55);
assert.equal(byTestId("time").textContent, "05:00");
assert.equal(byTestId("completed-count").textContent, "1");
assert.equal(byTestId("focus-minutes").textContent, "1");
assert.equal(byTestId("start-pause").textContent, "开始");
assert.equal(byTestId("mode-short").getAttribute("aria-pressed"), "true");

byTestId("task-list").children[0].children[0].click();
assert.equal(byTestId("done-count").textContent, "1");
assert.equal(byTestId("focus-task").textContent, "还没有任务，添加一个要完成的小目标。");

byTestId("mode-work").click();
assert.equal(byTestId("time").textContent, "01:00");
byTestId("skip").click();
assert.equal(byTestId("completed-count").textContent, "1");
assert.equal(byTestId("mode-short").getAttribute("aria-pressed"), "true");

console.log("Pomodoro DOM tests passed");
