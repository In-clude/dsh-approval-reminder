# Changelog

本项目的显著变更记录在这里，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-10-18

### Added

- 首个版本：监听客户端会话状态快照里的待审批交互（`kind === 'approval'`），
  为每个请求发出一次 Edge/Windows 桌面通知；审批结束后自动关闭通知。
- 点击通知跳回对应会话并聚焦窗口。
- 设置 → 通用 的「审批桌面通知」行：权限状态、开启入口、发送测试通知，
  以及被阻止/不支持时的恢复说明。
- 首次用户手势时自动请求通知权限；页面每次加载最多请求一次。
- 无依赖静态检查脚本（`node scripts/check.mjs`）与 GitHub Actions 工作流。

[0.1.0]: https://github.com/In-clude/dsh-approval-reminder/releases/tag/v0.1.0
