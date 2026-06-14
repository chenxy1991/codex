import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activeTask,
  addTask,
  completeCurrentSession,
  durationFor,
  formatTime,
  loadState,
  modes,
  normalizeState,
  type PomodoroMode,
  type PomodoroState,
  removeTask,
  resetCurrent,
  serializeState,
  setActiveTask,
  storageKey,
  switchMode,
  tickState,
  toggleTaskDone,
  updateSetting,
  updateTheme
} from "./pomodoro";

declare global {
  interface Window {
    __pomodoroApp?: {
      readonly state: PomodoroState;
      resetForTest: (seed?: Partial<PomodoroState>) => void;
      tick: (seconds?: number) => void;
      storageKey: string;
    };
  }
}

export function App() {
  const [state, setState] = useState(() => loadState(window.localStorage));
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    document.documentElement.setAttribute("data-theme", state.theme);
    window.localStorage.setItem(storageKey, serializeState(state));
  }, [state]);

  const applyState = useCallback((updater: (current: PomodoroState) => PomodoroState, message: string | null = null) => {
    setState((current) => updater(current));
    setSessionMessage(message);
  }, []);

  const tick = useCallback((seconds = 1) => {
    setState((current) => {
      const result = tickState(current, seconds);
      setSessionMessage(result.message);
      return result.state;
    });
  }, []);

  useEffect(() => {
    if (!state.isRunning) return undefined;
    const interval = window.setInterval(() => tick(1), 1000);
    return () => window.clearInterval(interval);
  }, [state.isRunning, tick]);

  useEffect(() => {
    window.__pomodoroApp = {
      get state() {
        return JSON.parse(JSON.stringify(stateRef.current)) as PomodoroState;
      },
      resetForTest(seed = {}) {
        setSessionMessage(null);
        setTaskTitle("");
        setState(normalizeState(seed));
      },
      tick,
      storageKey
    };

    return () => {
      delete window.__pomodoroApp;
    };
  }, [tick]);

  const active = activeTask(state);
  const total = durationFor(state.mode, state.settings);
  const elapsed = total - state.remainingSeconds;
  const progress = total > 0 ? (elapsed / total) * 360 : 0;
  const status = state.isRunning
    ? `${modes[state.mode].label}进行中。`
    : sessionMessage || `准备开始${modes[state.mode].label}。`;

  const doneCount = useMemo(
    () => state.tasks.filter((task) => task.done).length,
    [state.tasks]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyState((current) => addTask(current, taskTitle));
    setTaskTitle("");
  }

  return (
    <main className="app">
      <section className="timer-panel" aria-label="番茄钟计时器">
        <div>
          <header className="topbar">
            <div className="title-block">
              <h1>番茄钟</h1>
              <div className="subtitle">专注一段时间，休息一下，再继续。默认 25 分钟专注、5 分钟短休息、15 分钟长休息。</div>
            </div>
            <div className="topbar-actions">
              <label className="theme-field" htmlFor="theme-toggle">
                主题
                <select
                  className="theme-select"
                  id="theme-toggle"
                  data-testid="theme-toggle"
                  aria-label="切换主题"
                  value={state.theme}
                  onChange={(event) => applyState((current) => updateTheme(current, event.target.value))}
                >
                  <option value="light">浅色模式</option>
                  <option value="dark">深色模式</option>
                  <option value="transparent">透明模式</option>
                </select>
              </label>
              <div className="stats" data-testid="cycle-label">第 {state.completedPomodoros + 1} 轮</div>
            </div>
          </header>

          <nav className="mode-tabs" aria-label="计时模式">
            {modeButton("work", "专注")}
            {modeButton("short", "短休息")}
            {modeButton("long", "长休息")}
          </nav>

          <div className="clock-wrap">
            <div
              className="progress-ring"
              data-testid="progress-ring"
              aria-hidden="true"
              style={{ "--progress": `${progress}deg` } as CSSProperties}
            >
              <div className="clock-face">
                <div className="time" data-testid="time">{formatTime(state.remainingSeconds)}</div>
              </div>
            </div>
            <div className="status" data-testid="status" aria-live="polite">{status}</div>
            <div className="controls">
              <button
                className="button primary"
                type="button"
                data-testid="start-pause"
                onClick={() => applyState((current) => ({ ...current, isRunning: !current.isRunning }))}
              >
                {state.isRunning ? "暂停" : "开始"}
              </button>
              <button
                className="button"
                type="button"
                data-testid="reset"
                onClick={() => applyState(resetCurrent)}
              >
                重置
              </button>
              <button
                className="button ghost"
                type="button"
                data-testid="skip"
                onClick={() => {
                  const result = completeCurrentSession(state, { countWork: false });
                  applyState(() => result.state, result.message);
                }}
              >
                跳过
              </button>
            </div>
          </div>
        </div>

        <div className="focus-card">
          <div className="focus-label">当前任务</div>
          <div className="focus-task" data-testid="focus-task">
            {active ? active.title : "还没有任务，添加一个要完成的小目标。"}
          </div>
        </div>
      </section>

      <aside className="side-panel" aria-label="番茄钟设置和任务">
        <section className="section" aria-label="今日统计">
          <h2>今日统计</h2>
          <div className="stats-grid">
            <div className="stat">
              <strong data-testid="completed-count">{state.completedPomodoros}</strong>
              <span>完成番茄</span>
            </div>
            <div className="stat">
              <strong data-testid="focus-minutes">{Math.floor(state.focusSeconds / 60)}</strong>
              <span>专注分钟</span>
            </div>
            <div className="stat">
              <strong data-testid="done-count">{doneCount}</strong>
              <span>完成任务</span>
            </div>
          </div>
        </section>

        <section className="section" aria-label="时长设置">
          <h2>时长设置</h2>
          <div className="settings-grid">
            <DurationInput
              id="work-minutes"
              testId="setting-work"
              label="专注"
              value={state.settings.workMinutes}
              min={1}
              max={180}
              onChange={(value) => applyState((current) => updateSetting(current, "workMinutes", value))}
            />
            <DurationInput
              id="short-minutes"
              testId="setting-short"
              label="短休"
              value={state.settings.shortMinutes}
              min={1}
              max={60}
              onChange={(value) => applyState((current) => updateSetting(current, "shortMinutes", value))}
            />
            <DurationInput
              id="long-minutes"
              testId="setting-long"
              label="长休"
              value={state.settings.longMinutes}
              min={1}
              max={90}
              onChange={(value) => applyState((current) => updateSetting(current, "longMinutes", value))}
            />
          </div>
          <div className="helper">修改当前模式的时长会立即重置该模式计时。</div>
        </section>

        <section className="section" aria-label="任务清单">
          <h2>任务清单</h2>
          <form className="task-form" data-testid="task-form" onSubmit={handleSubmit}>
            <input
              className="task-input"
              data-testid="task-input"
              type="text"
              placeholder="添加任务，例如：整理需求"
              autoComplete="off"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
            />
            <button className="button" type="submit" data-testid="add-task">添加</button>
          </form>
          <ul className="task-list" data-testid="task-list">
            {state.tasks.map((task) => (
              <li
                className={`task-item${task.done ? " done" : ""}${task.active ? " active" : ""}`}
                data-task-id={task.id}
                key={task.id}
              >
                <button
                  type="button"
                  className="task-toggle"
                  aria-label={task.done ? "标记为未完成" : "标记为完成"}
                  onClick={() => applyState((current) => toggleTaskDone(current, task.id))}
                >
                  {task.done ? "✓" : ""}
                </button>
                <div className="task-title">{task.title}</div>
                <div className="task-actions">
                  <button
                    type="button"
                    className="icon-button"
                    disabled={task.done}
                    title="设为当前任务"
                    aria-label="设为当前任务"
                    onClick={() => applyState((current) => setActiveTask(current, task.id))}
                  >
                    &gt;
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title="删除任务"
                    aria-label="删除任务"
                    onClick={() => applyState((current) => removeTask(current, task.id))}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className={`empty${state.tasks.length > 0 ? " hidden" : ""}`} data-testid="empty-tasks">
            清单为空。先写下这轮要推进的事。
          </div>
        </section>
      </aside>
    </main>
  );

  function modeButton(mode: PomodoroMode, label: string) {
    return (
      <button
        className="mode-tab"
        type="button"
        data-mode={mode}
        data-testid={`mode-${mode}`}
        aria-pressed={state.mode === mode}
        onClick={() => applyState((current) => switchMode(current, mode, false))}
      >
        {label}
      </button>
    );
  }
}

interface DurationInputProps {
  id: string;
  testId: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: string) => void;
}

function DurationInput({ id, testId, label, value, min, max, onChange }: DurationInputProps) {
  return (
    <div className="setting">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        data-testid={testId}
        type="number"
        min={min}
        max={max}
        value={value}
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
