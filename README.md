# 番茄钟桌面客户端

这是一个 Electron + React + TypeScript 版本的番茄钟桌面客户端。原始单文件网页版本保留在 `html/outputs/index.html`，作为迁移前归档。

## Scripts

- `npm run dev`: 启动 Vite 和 Electron 开发窗口。
- `npm run typecheck`: 检查 renderer 和 main 进程 TypeScript。
- `npm test`: 运行 Vitest 单元测试和 React DOM 测试。
- `npm run build`: 构建 renderer 和 Electron main 进程。
- `npm run test:e2e`: 构建后启动 Electron smoke test。
- `npm run electron:build`: 生成 macOS 安装包。

## Notes

Renderer 侧继续使用 `localStorage` 持久化番茄钟数据，存储键为 `pomodoroTimer.v1`。Electron 窗口启用 `contextIsolation`、禁用 `nodeIntegration`，当前版本不向 renderer 暴露 Node API。
