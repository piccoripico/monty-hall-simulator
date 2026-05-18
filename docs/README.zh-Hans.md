# 蒙提霍尔模拟器

[English](../README.md)

- [模拟器](https://piccoripico.github.io/monty-hall-simulator/)

一个用于在浏览器中体验蒙提霍尔问题的静态多语言实验工具，可直接发布到 GitHub Pages。

## 什么是蒙提霍尔问题？

蒙提霍尔问题是一个关于在关闭的门之间做选择的概率谜题。多扇门中只有一扇门后面有奖品，其余门后面没有。你先选择一扇门后，知道奖品位置的蒙提会打开失败门，并留下你选择的门和另一扇关闭的门。

令人意外的问题是：你应该坚持最初的选择，还是换到剩下的另一扇关闭门？这个模拟器可以反复运行实验，查看每一次生成的试验，并把观察到的结果与理论概率进行比较。

## 功能

- 三种执行模式：只不换门、只换门，或同时模拟两种策略。
- 完整试验列表，包括奖品门、第一次选择、蒙提留下的门、最终选择和结果。
- 可配置门数，每个所选策略最多 100,000 次试验。
- 使用 KaTeX 显示条件概率和贝叶斯公式的理论补充。
- UI 支持英语、法语、西班牙语、德语、日语、简体中文、繁体中文和韩语。

## 开发

```powershell
npm.cmd install
npm.cmd run verify
```

常用脚本：

- `npm.cmd test`：运行单元测试和 i18n 测试。
- `npm.cmd run build`：将静态应用复制到 `dist/`。
- `npm.cmd run test:e2e`：针对 `dist/` 运行 Playwright 测试。
- `npm.cmd start`：在 <http://127.0.0.1:4174/> 提供 `dist/`。

如果 PowerShell 阻止 `npm`，请像上面一样使用 `npm.cmd`。

## GitHub Pages

`.github/workflows/pages.yml` 工作流会在推送到 `main` 或手动运行时构建、测试，并将 `dist/` 作为 Pages artifact 上传。

启用 GitHub Pages 后，预期 URL 格式为：

```text
https://<OWNER>.github.io/monty-hall-simulator/
```
