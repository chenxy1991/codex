import { describe, expect, it } from "vitest";
import {
  addTask,
  completeCurrentSession,
  defaultState,
  normalizeState,
  normalizeTheme,
  removeTask,
  switchMode,
  tickState,
  toggleTaskDone,
  updateSetting
} from "./pomodoro";

describe("pomodoro state", () => {
  it("creates the default timer state", () => {
    const state = defaultState();

    expect(state.mode).toBe("work");
    expect(state.theme).toBe("light");
    expect(state.remainingSeconds).toBe(25 * 60);
    expect(state.settings.shortMinutes).toBe(5);
  });

  it("normalizes persisted state and clamps invalid settings", () => {
    const state = normalizeState({
      mode: "missing",
      theme: "transparent",
      remainingSeconds: 999999,
      completedPomodoros: -10,
      focusSeconds: -20,
      settings: {
        workMinutes: 999,
        shortMinutes: -1,
        longMinutes: 0,
        longBreakEvery: 0
      },
      tasks: [{ title: "  " }]
    });

    expect(state.mode).toBe("work");
    expect(state.theme).toBe("transparent");
    expect(state.remainingSeconds).toBe(180 * 60);
    expect(state.completedPomodoros).toBe(0);
    expect(state.focusSeconds).toBe(0);
    expect(state.settings.workMinutes).toBe(180);
    expect(state.settings.shortMinutes).toBe(1);
    expect(state.settings.longMinutes).toBe(15);
    expect(state.settings.longBreakEvery).toBe(4);
    expect(state.tasks[0].title).toBe("未命名任务");
  });

  it("falls back to the light theme for unknown theme values", () => {
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("transparent")).toBe("transparent");
    expect(normalizeTheme("neon")).toBe("light");
  });

  it("ticks a running work session and counts focus seconds", () => {
    const state = {
      ...defaultState(),
      isRunning: true,
      remainingSeconds: 60
    };

    const result = tickState(state, 5);

    expect(result.state.remainingSeconds).toBe(55);
    expect(result.state.focusSeconds).toBe(5);
    expect(result.state.isRunning).toBe(true);
    expect(result.message).toBeNull();
  });

  it("completes work sessions and enters short or long breaks", () => {
    const shortResult = tickState({
      ...defaultState(),
      isRunning: true,
      remainingSeconds: 1
    });

    expect(shortResult.state.mode).toBe("short");
    expect(shortResult.state.completedPomodoros).toBe(1);
    expect(shortResult.state.remainingSeconds).toBe(5 * 60);
    expect(shortResult.state.isRunning).toBe(false);

    const longResult = tickState({
      ...defaultState(),
      isRunning: true,
      completedPomodoros: 3,
      remainingSeconds: 1
    });

    expect(longResult.state.mode).toBe("long");
    expect(longResult.state.completedPomodoros).toBe(4);
    expect(longResult.state.remainingSeconds).toBe(15 * 60);
  });

  it("returns to work after a break completes", () => {
    const state = switchMode(defaultState(), "short", true);
    const result = tickState({ ...state, remainingSeconds: 1 });

    expect(result.state.mode).toBe("work");
    expect(result.state.completedPomodoros).toBe(0);
    expect(result.state.remainingSeconds).toBe(25 * 60);
  });

  it("skips work without increasing completed pomodoros", () => {
    const result = completeCurrentSession(
      { ...defaultState(), completedPomodoros: 1 },
      { countWork: false }
    );

    expect(result.state.mode).toBe("short");
    expect(result.state.completedPomodoros).toBe(1);
  });

  it("updates current mode duration by resetting the current timer", () => {
    const state = updateSetting(defaultState(), "workMinutes", "1");

    expect(state.settings.workMinutes).toBe(1);
    expect(state.remainingSeconds).toBe(60);
    expect(state.isRunning).toBe(false);
  });

  it("adds, completes, and removes tasks while preserving active task behavior", () => {
    let state = addTask(defaultState(), "写测试", "task-1");
    state = addTask(state, "做迁移", "task-2");

    expect(state.tasks[0].active).toBe(true);
    expect(state.tasks[1].active).toBe(false);

    state = toggleTaskDone(state, "task-1");
    expect(state.tasks[0].done).toBe(true);
    expect(state.tasks[0].active).toBe(false);
    expect(state.tasks[1].active).toBe(true);

    state = removeTask(state, "task-2");
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe("task-1");
  });
});
