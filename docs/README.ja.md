# モンティ・ホールシミュレーター

モンティ・ホール問題をブラウザ上で試せる、多言語対応の静的シミュレーターです。GitHub Pagesで公開できます。

![モンティ・ホールシミュレーターのスクリーンショット](assets/screenshot.png)

- 公開サイト: [シミュレーター](https://piccoripico.github.io/monty-hall-simulator/)

## Multilingual Documents

- [English](../README.md)
- [Français](README.fr.md)
- [Español](README.es.md)
- [Deutsch](README.de.md)
- [简体中文](README.zh-Hans.md)
- [繁體中文](README.zh-Hant.md)
- [한국어](README.ko.md)

## モンティ・ホール問題とは？

モンティ・ホール問題は、閉じたドアの中から当たりを選ぶ確率パズルです。複数のドアのうち1つに当たりがあり、残りははずれです。あなたが最初に1つ選ぶと、当たりを知っているモンティが、あなたの選んだドアともう1つのドアを残して、はずれドアを開けます。

直感に反する問いは、最初の選択を変えないべきか、残された別のドアへ変えるべきか、という点です。このシミュレーターでは、その試行を何度も実行し、生成された全試行を確認しながら、観測結果と理論上の確率を比べられます。

## 機能

- ドアをクリックして手動で遊べるPlayモード。
- ドアの数は3から1,000まで選択可能。
- 「変えないのみ」「変えるのみ」「両方」を最大100,000回ずつ実行できるBatchモード。
- Mode列とAll / Play / Batchフィルタを備えた共有の試行一覧。
- 集計結果と試行一覧のExcel出力。
- KaTeXで表示する条件付き確率とベイズの定理の補足。
- 英語、フランス語、スペイン語、ドイツ語、日本語、簡体字中国語、繁体字中国語、韓国語のUI。

## 開発

```powershell
npm.cmd install
npm.cmd run verify
```

便利なスクリプト:

- `npm.cmd test`: 単体テストとi18nテストを実行します。
- `npm.cmd run build`: 静的アプリを `dist/` にコピーします。
- `npm.cmd run test:e2e`: `dist/` に対してPlaywrightの確認テストを実行します。
- `npm.cmd start`: `dist/` を <http://127.0.0.1:4174/> で配信します。

PowerShellで `npm` がブロックされる場合は、上記のように `npm.cmd` を使ってください。

## GitHub Pages

`.github/workflows/pages.yml` のワークフローは、`main` へのpushまたは手動実行で、ビルド、テスト、`dist/` のPages artifactアップロードを行います。

GitHub Pagesを有効化した後の公開URL形式は次のとおりです。

```text
https://<OWNER>.github.io/monty-hall-simulator/
```
