import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the default pomodoro UI", () => {
    render(<App />);

    expect(screen.getByTestId("time")).toHaveTextContent("25:00");
    expect(screen.getByTestId("status")).toHaveTextContent("准备开始专注。");
    expect(screen.getByTestId("completed-count")).toHaveTextContent("0");
    expect(screen.getByTestId("theme-toggle")).toHaveValue("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("runs the core user flow", async () => {
    render(<App />);

    fireEvent.change(screen.getByTestId("theme-toggle"), { target: { value: "dark" } });
    expect(screen.getByTestId("theme-toggle")).toHaveValue("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    fireEvent.change(screen.getByTestId("theme-toggle"), { target: { value: "transparent" } });
    expect(screen.getByTestId("theme-toggle")).toHaveValue("transparent");
    expect(document.documentElement).toHaveAttribute("data-theme", "transparent");

    fireEvent.change(screen.getByTestId("task-input"), { target: { value: "写完番茄钟测试" } });
    fireEvent.click(screen.getByTestId("add-task"));
    expect(screen.getByTestId("focus-task")).toHaveTextContent("写完番茄钟测试");
    expect(document.querySelectorAll(".task-item")).toHaveLength(1);

    fireEvent.change(screen.getByTestId("setting-work"), { target: { value: "1" } });
    expect(screen.getByTestId("time")).toHaveTextContent("01:00");

    fireEvent.click(screen.getByTestId("start-pause"));
    act(() => {
      window.__pomodoroApp?.tick(5);
    });
    await waitFor(() => expect(screen.getByTestId("time")).toHaveTextContent("00:55"));
    expect(screen.getByTestId("start-pause")).toHaveTextContent("暂停");

    act(() => {
      window.__pomodoroApp?.tick(55);
    });
    await waitFor(() => expect(screen.getByTestId("time")).toHaveTextContent("05:00"));
    expect(screen.getByTestId("completed-count")).toHaveTextContent("1");
    expect(screen.getByTestId("focus-minutes")).toHaveTextContent("1");
    expect(screen.getByTestId("start-pause")).toHaveTextContent("开始");
    expect(screen.getByTestId("mode-short")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(document.querySelector(".task-toggle")!);
    expect(screen.getByTestId("done-count")).toHaveTextContent("1");
    expect(screen.getByTestId("focus-task")).toHaveTextContent("还没有任务，添加一个要完成的小目标。");

    fireEvent.click(screen.getByTestId("mode-work"));
    expect(screen.getByTestId("time")).toHaveTextContent("01:00");
    fireEvent.click(screen.getByTestId("skip"));
    expect(screen.getByTestId("completed-count")).toHaveTextContent("1");
    expect(screen.getByTestId("mode-short")).toHaveAttribute("aria-pressed", "true");
  });
});
