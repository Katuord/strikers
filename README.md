# Strikers!! // CYBER CORE OVERLOAD

サイバーパンク風の演出と高機能な譜面エディタを備えた、HTML5 Canvas / JavaScript 製の本格ブラウザリズムゲームです。

---

## 🎮 概要

SoundCloud API と HTML5 Canvas を使用して動作する 4キー 方式のリズムアクションゲームです。
直感的なリアルタイム譜面エディタを搭載しており、オリジナルの譜面を作成・保存・共有できます。

---

## 🚀 主な機能

* **4キー方式リズムアクション**
  * 初期設定キー: `D` / `F` / `J` / `K`（オプションから変更可能）
* **多彩なノーツギミック**
  * **通常ノーツ** / **ロングノーツ**（長押し）
  * **毒ノーツ（Poison/Fake）**: 叩くとゲージ減少＆コンボ切断
  * **演出ノーツ**: フラッシュ、画面揺れ、画面反転などのトリガー
* **詳細な判定＆オプション機能**
  * PERFECT / GREAT / GOOD / MISS 判定、ミリ秒表示（`EARLY / LATE`）
  * ノーツスピード調整（1.0x 〜 5.0x）、判定ライン位置調整、レーンカバー（SUDDEN / HIDDEN）
  * ミラー（MIRROR） / ランダム（RANDOM） / オートプレイ（AUTO PLAY）
  * カラーテーマ切替（CYBER / LIGHT / MONOCHROME）
* **リアルタイム譜面エディタ（CHART EDITOR）**
  * 楽曲を再生しながらキー入力で直感的にノーツを配置・録音（REC）
  * グリッドスナップ（0.25s, 0.10s, 0.05s, FREE）および拡大率（ZOOM）変更
  * アシストティック（ノーツ打音通知）
  * テストプレイ機能および JSON 形式の Export / Import
* **データ保存機能**
  * `LocalStorage` によるユーザープロフィール（レベル/XP）、ハイスコア、キーバインド、音量設定の自動保存

---

https://katuord.github.io/strikers/

## 📁 ディレクトリ構成

```text
strikers/
├── index.html        # メインHTML（直下に配置）
├── style.css         # スタイルシート（ネオン・サイバーデザイン）
├── main.js           # ゲームエンジン・エディタ・描画ロジック
├── assets/           # 音源・SE・画像リソース（任意）
└── charts/           # 譜面データ（JSON）
