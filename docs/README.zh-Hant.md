# 蒙提霍爾模擬器

一個可在瀏覽器中體驗蒙提霍爾問題的靜態多語言實驗工具，可直接發布到 GitHub Pages。

![蒙提霍爾模擬器截圖](assets/screenshot.png)

- 線上網站：[模擬器](https://piccoripico.github.io/monty-hall-simulator/)

## Multilingual Documents

- [English](../README.md)
- [日本語](README.ja.md)
- [Français](README.fr.md)
- [Español](README.es.md)
- [Deutsch](README.de.md)
- [简体中文](README.zh-Hans.md)
- [한국어](README.ko.md)

## 什麼是蒙提霍爾問題？

蒙提霍爾問題是一個關於在關閉的門之間做選擇的機率謎題。多扇門中只有一扇門後面有獎品，其餘門後面沒有。你先選擇一扇門後，知道獎品位置的蒙提會打開失敗門，並留下你選擇的門和另一扇關閉的門。

令人意外的問題是：你應該堅持最初的選擇，還是換到剩下的另一扇關閉門？這個模擬器可以反覆執行實驗，查看每一次產生的試驗，並把觀察到的結果與理論機率進行比較。

## 功能

- Play 模式，可點擊門手動完成一輪遊戲。
- 門數可在 3 到 1,000 之間選擇。
- Batch 模式，可只不換門、只換門，或同時模擬兩種策略；每個所選策略最多 100,000 次試驗。
- 共享試驗列表，包含 Mode 欄和 All / Play / Batch 篩選。
- 將統計結果和全部試驗列匯出為 Excel。
- 使用 KaTeX 顯示條件機率和貝葉斯公式的理論補充。
- UI 支援英語、法語、西班牙語、德語、日語、簡體中文、繁體中文和韓語。

## 開發

```powershell
npm.cmd install
npm.cmd run verify
```

常用腳本：

- `npm.cmd test`：執行單元測試和 i18n 測試。
- `npm.cmd run build`：將靜態應用複製到 `dist/`。
- `npm.cmd run test:e2e`：針對 `dist/` 執行 Playwright 測試。
- `npm.cmd start`：在 <http://127.0.0.1:4174/> 提供 `dist/`。

如果 PowerShell 阻止 `npm`，請像上面一樣使用 `npm.cmd`。

## GitHub Pages

`.github/workflows/pages.yml` 工作流程會在推送到 `main` 或手動執行時建置、測試，並將 `dist/` 作為 Pages artifact 上傳。

啟用 GitHub Pages 後，預期 URL 格式為：

```text
https://<OWNER>.github.io/monty-hall-simulator/
```
