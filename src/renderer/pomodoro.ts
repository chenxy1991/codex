export type PomodoroMode = "work" | "short" | "long";
export type PomodoroTheme = "light" | "dark" | "transparent";

export interface PomodoroSettings {
  workMinutes: number;
  shortMinutes: number;
  longMinutes: number;
  longBreakEvery: number;
}

export interface PomodoroTask {
  id: string;
  title: string;
  done: boolean;
  active: boolean;
}

export interface PomodoroState {
  mode: PomodoroMode;
  theme: PomodoroTheme;
  isRunning: boolean;
  remainingSeconds: number;
  settings: PomodoroSettings;
  completedPomodoros: number;
  focusSeconds: number;
  tasks: PomodoroTask[];
}

export const storageKey = "pomodoroTimer.v1";

export const modes: Record<PomodoroMode, { label: string; setting: keyof PomodoroSettings }> = {
  work: { label: "专注", setting: "workMinutes" },
  short: { label: "短休息", setting: "shortMinutes" },
  long: { label: "长休息", setting: "longMinutes" }
};

const themes: PomodoroTheme[] = ["light", "dark", "transparent"];

const settingLimits: Record<keyof Pick<PomodoroSettings, "workMinutes" | "shortMinutes" | "longMinutes">, [number, number]> = {
  workMinutes: [1, 180],
  shortMinutes: [1, 60],
  longMinutes: [1, 90]
};

export function defaultState(): PomodoroState {
  return {
    mode: "work",
    theme: "light",
    isRunning: false,
    remainingSeconds: 25 * 60,
    settings: {
      workMinutes: 25,
      shortMinutes: 5,
      longMinutes: 15,
      longBreakEvery: 4
    },
    completedPomodoros: 0,
    focusSeconds: 0,
    tasks: []
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeTheme(theme: unknown): PomodoroTheme {
  return themes.includes(theme as PomodoroTheme) ? (theme as PomodoroTheme) : "light";
}

export function durationFor(mode: PomodoroMode, settings: PomodoroSettings) {
  return settings[modes[mode].setting] * 60;
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function normalizeTask(task: Partial<PomodoroTask> & { title?: unknown }): PomodoroTask {
  return {
    id: task.id || makeTaskId(),
    title: String(task.title || "").trim() || "未命名任务",
    done: Boolean(task.done),
    active: Boolean(task.active)
  };
}

export function normalizeState(saved: unknown): PomodoroState {
  if (!saved || typeof saved !== "object") return defaultState();

  const source = saved as Partial<PomodoroState>;
  const next = defaultState();
  next.settings = {
    ...next.settings,
    ...(source.settings || {})
  };
  next.settings.workMinutes = clamp(Number(next.settings.workMinutes) || 25, 1, 180);
  next.settings.shortMinutes = clamp(Number(next.settings.shortMinutes) || 5, 1, 60);
  next.settings.longMinutes = clamp(Number(next.settings.longMinutes) || 15, 1, 90);
  next.settings.longBreakEvery = Math.max(1, Number(next.settings.longBreakEvery) || 4);
  next.mode = source.mode && source.mode in modes ? source.mode : "work";
  next.theme = normalizeTheme(source.theme);
  next.remainingSeconds = clamp(
    Number(source.remainingSeconds) || durationFor(next.mode, next.settings),
    0,
    durationFor(next.mode, next.settings)
  );
  next.completedPomodoros = Math.max(0, Number(source.completedPomodoros) || 0);
  next.focusSeconds = Math.max(0, Number(source.focusSeconds) || 0);
  next.tasks = Array.isArray(source.tasks) ? source.tasks.map(normalizeTask) : [];
  next.isRunning = false;
  return next;
}

export function loadState(storage: Pick<Storage, "getItem">): PomodoroState {
  try {
    return normalizeState(JSON.parse(storage.getItem(storageKey) || "null"));
  } catch {
    return defaultState();
  }
}

export function serializeState(state: PomodoroState) {
  return JSON.stringify({ ...state, isRunning: false });
}

export function activeTask(state: PomodoroState) {
  return state.tasks.find((task) => task.active && !task.done)
    || state.tasks.find((task) => !task.done)
    || null;
}

export function switchMode(state: PomodoroState, mode: PomodoroMode, shouldRun = false): PomodoroState {
  return {
    ...state,
    mode,
    remainingSeconds: durationFor(mode, state.settings),
    isRunning: shouldRun
  };
}

export function nextModeAfterCompletion(state: PomodoroState): PomodoroMode {
  if (state.mode !== "work") return "work";
  return state.completedPomodoros % state.settings.longBreakEvery === 0 ? "long" : "short";
}

export function completeCurrentSession(state: PomodoroState, options: { countWork?: boolean } = {}) {
  const countWork = options.countWork ?? true;
  const completedMode = state.mode;
  const completedPomodoros = completedMode === "work" && countWork
    ? state.completedPomodoros + 1
    : state.completedPomodoros;
  const countedState = { ...state, completedPomodoros };
  const mode = nextModeAfterCompletion(countedState);

  return {
    state: {
      ...countedState,
      mode,
      remainingSeconds: durationFor(mode, state.settings),
      isRunning: false
    },
    message: completedMode === "work" ? "这轮专注完成了，休息一下。" : "休息结束，回到专注。"
  };
}

export function tickState(state: PomodoroState, seconds = 1) {
  let next = { ...state };
  const wholeSeconds = Math.max(0, Math.floor(seconds));

  for (let index = 0; index < wholeSeconds; index += 1) {
    if (!next.isRunning) break;
    next = {
      ...next,
      focusSeconds: next.mode === "work" ? next.focusSeconds + 1 : next.focusSeconds,
      remainingSeconds: Math.max(0, next.remainingSeconds - 1)
    };
    if (next.remainingSeconds === 0) return completeCurrentSession(next);
  }

  return { state: next, message: null as string | null };
}

export function resetCurrent(state: PomodoroState): PomodoroState {
  return {
    ...state,
    isRunning: false,
    remainingSeconds: durationFor(state.mode, state.settings)
  };
}

export function updateSetting(state: PomodoroState, key: keyof typeof settingLimits, value: string | number): PomodoroState {
  const [min, max] = settingLimits[key];
  const settings = {
    ...state.settings,
    [key]: clamp(Number(value) || min, min, max)
  };
  const next = { ...state, settings };
  return modes[state.mode].setting === key ? resetCurrent(next) : next;
}

export function updateTheme(state: PomodoroState, theme: unknown): PomodoroState {
  return { ...state, theme: normalizeTheme(theme) };
}

export function addTask(state: PomodoroState, title: string, id: string = makeTaskId()): PomodoroState {
  const trimmed = title.trim();
  if (!trimmed) return state;
  const hasActive = state.tasks.some((task) => task.active && !task.done);
  return {
    ...state,
    tasks: [
      ...state.tasks,
      { id, title: trimmed, done: false, active: !hasActive }
    ]
  };
}

export function setActiveTask(state: PomodoroState, id: string): PomodoroState {
  return {
    ...state,
    tasks: state.tasks.map((task) => ({ ...task, active: task.id === id }))
  };
}

export function toggleTaskDone(state: PomodoroState, id: string): PomodoroState {
  const tasks = state.tasks.map((task) => task.id === id
    ? { ...task, done: !task.done, active: task.done ? task.active : false }
    : task
  );
  if (!tasks.some((task) => task.active && !task.done)) {
    const nextTask = tasks.find((task) => !task.done);
    if (nextTask) nextTask.active = true;
  }
  return { ...state, tasks };
}

export function removeTask(state: PomodoroState, id: string): PomodoroState {
  const removedWasActive = state.tasks.some((task) => task.id === id && task.active);
  const tasks = state.tasks.filter((task) => task.id !== id);
  if (removedWasActive) {
    const nextTask = tasks.find((task) => !task.done);
    if (nextTask) nextTask.active = true;
  }
  return { ...state, tasks };
}

function makeTaskId(): string {
  return globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random());
}
