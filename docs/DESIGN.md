# Exam Score Digest — 系統分析與架構設計（v0.2）

> 狀態：設計已確認待決項目（見第 8 節），等待開工確認。

---

## 1. 需求分析

### 1.1 使用者與情境

| 角色 | 需求 |
|---|---|
| 教學組長（主要使用者） | 把 12 班的成績檔丟進一個資料夾，一個指令產出報表與總表，取代整個週末的 Excel 作業 |
| 導師（資料提供者） | 不需改變習慣，校務系統匯出或 Excel 另存都能直接交 |
| 學生／家長（公開版讀者） | 只看得到統計與分布，看不到任何個人資料 |

### 1.2 隱藏的技術風險（題目沒明講、但驗收一定會踩到）

1. **編碼**：繁中 Windows 上，校務系統匯出的 CSV 與 Excel「CSV（逗號分隔）」另存的檔案，通常是 **Big5（CP950）**；Excel「CSV UTF-8」另存則是 **UTF-8 + BOM**。驗收要求「姓名沒有亂碼或問號」，所以必須自動偵測編碼。
2. **Excel 另存的副作用**：學號被轉成數字（前導 0 消失）、分數變成公式或文字格式的數字、尾端多出空白列／空白欄、導師自行加了「總分」「平均」欄。
3. **全形字**：導師手打的「８５」、「　」（全形空白）。
4. **浮點數**：平均分數同分判定若用浮點數比較，85.1+85.2 這類會產生誤差，導致同分不同名次。
5. **`http://` 檢查**：inline SVG 習慣寫 `xmlns="http://www.w3.org/2000/svg"`，會讓「搜尋不到 http://」驗收失敗。HTML5 內嵌 SVG 不需要 xmlns，直接省略。

### 1.3 名詞定義（統一用語）

| 名詞 | 定義 |
|---|---|
| 應考人數 | 該科成功匯入的學生數（含缺考） |
| 實考人數 | 應考人數 − 缺考人數 |
| 缺考 | 分數欄為「缺」「缺考」或空白（清單可在設定檔調整） |
| 有效分數 | 0–100、最多一位小數的數字 |
| 列號 | 與 Excel 中看到的列號一致：標題列 = 第 1 列，第一筆資料 = 第 2 列 |

---

## 2. 計算規則（README 也會寫同一份）

| 項目 | 規則 |
|---|---|
| 分數儲存 | 內部一律以「整數十分位」儲存（85.5 → 855），避免浮點誤差；只在輸出時轉回小數 |
| 分數解析 | 先做 NFKC 正規化（全形→半形）與 trim；符合 `^\d{1,3}(\.\d)?$` 且 0 ≤ x ≤ 100 才有效。`85.55`、`101`、`-5`、`八十` 皆為錯誤 |
| 錯誤列 | 任一科分數錯誤或缺學號 → 整列跳過，記入匯入問題清單（檔名、列號、原因） |
| 完全空白列 | 靜默略過（Excel 殘留），不列為問題 |
| 平均 | 分母 = 實考人數 |
| 中位數 | 偶數筆取中間兩數平均 |
| 標準差 | 母體標準差（σ，等同 Excel `STDEV.P`） |
| 及格率 | 分數 ≥ 60 的人數 ÷ 實考人數 |
| 個人總分／平均 | 只計有應考的科目；平均 = 總分 ÷ 實考科目數；另標示缺考科目數 |
| 排名 | 只有「無任何缺考」的學生參與；依平均分數（實作上比較十分位總分，完全精確）由高到低；競賽式排名 1、2、2、4 |
| PR 值 | `PR = 100 × (低於該生人數 + 0.5 × 同分人數) / 總人數`，總人數 = 參與排名人數；四捨五入（`Math.round`）後夾在 [1, 99]。同分人數含本人 |
| 分數級距 | `bin = min(floor(分數 / 10), 9)`；標籤沿用題目的 `0–9`、`10–19`…`90–100`，並另外標示邊界 `80 ≤ 分數 < 90`、`90 ≤ 分數 ≤ 100`，讓 89.9 → 80–89、100 → 90–100 一目了然 |
| 進步／退步 | 兩次都出現的學生，以「本次平均 − 上次平均」排序，取前 10 名；同差值以學號排序以確保結果固定 |
| 轉入／轉出 | 只在本次出現 = 轉入；只在上次出現 = 轉出。**但**若該學號在任一次是因資料錯誤被跳過，標示為「資料錯誤無法比較」，避免誤判為轉學 |

---

## 3. 系統架構

### 3.1 設計原則

- **Pipeline + 純函式**：I/O 只在頭（讀檔）尾（寫檔），中間全部是純函式 → 每一層都能用記憶體資料單元測試。
- **錯誤是資料，不是例外**：列層級問題收集成 `ImportIssue[]` 一路往下傳；只有「資料夾不存在、設定檔格式錯誤」這類無法繼續的情況才 throw（fail fast）。
- **公開版用型別保證去識別化**：公開版不是在模板裡「記得不印姓名」，而是先轉成一個**結構上根本沒有姓名／分數欄位**的 `PublicReportModel`，renderer 只吃這個型別。TypeScript 會在編譯期擋下洩漏。

### 3.2 資料流

```
          ┌─────────────┐
 資料夾 ──▶│ discover    │ 列出 *.csv / *.xlsx（排除 ~$ 暫存檔）
          └──────┬──────┘
                 ▼
          ┌─────────────┐   bytes ─▶ decode (BOM → UTF-8 strict → Big5)
          │ readers     │   csv / xlsx ─▶ RawTable { file, headers, rows[{rowNumber, cells}] }
          └──────┬──────┘
                 ▼
          ┌─────────────┐   設定檔 subjects.json
          │ normalize   │   header 對應 → 解析分數 → StudentRecord[] + ImportIssue[]
          └──────┬──────┘
                 ▼
          ┌─────────────┐
          │ dedupe      │   跨檔學號重複 → ImportIssue（兩個來源）+ 標記
          └──────┬──────┘
                 ▼                         （--prev 時對上次資料夾重跑上面四步）
          ┌─────────────┐
          │ analyze     │   subjectStats / studentSummary / ranking+PR / distribution / compare
          └──────┬──────┘
                 ▼
          ┌─────────────┐
          │ ReportModel │──(--public)──▶ redact ──▶ PublicReportModel
          └──────┬──────┘
          ┌──────┴───────┐
          ▼              ▼
     html renderer   xlsx writer
   (inline CSS/SVG)  (每班一表 + 全年級)
```

### 3.3 目錄結構

```
exam-score-digest/
├─ src/
│  ├─ cli.ts                    # util.parseArgs，參數驗證、exit code
│  ├─ build.ts                  # 串接整條 pipeline（唯一的 orchestrator）
│  ├─ config/
│  │  ├─ schema.ts              # 設定檔型別與驗證
│  │  └─ load.ts
│  ├─ io/
│  │  ├─ discover.ts
│  │  ├─ decode.ts              # 編碼偵測
│  │  ├─ read-csv.ts
│  │  └─ read-xlsx.ts
│  ├─ domain/
│  │  ├─ types.ts               # Score, StudentRecord, ImportIssue …
│  │  ├─ parse-score.ts
│  │  ├─ map-headers.ts         # 欄名 → 標準科目 / 基本欄位
│  │  ├─ normalize.ts
│  │  └─ dedupe.ts
│  ├─ stats/
│  │  ├─ descriptive.ts         # mean / median / sd / min / max
│  │  ├─ subject-stats.ts       # 全年級、各班
│  │  ├─ student-summary.ts
│  │  ├─ ranking.ts             # 競賽排名 + PR
│  │  ├─ distribution.ts
│  │  └─ compare.ts
│  ├─ report/
│  │  ├─ model.ts               # ReportModel 組裝
│  │  ├─ redact.ts              # → PublicReportModel、學號遮罩
│  │  ├─ html/
│  │  │  ├─ escape.ts
│  │  │  ├─ svg-charts.ts       # 長條圖、各班比較圖
│  │  │  ├─ render-full.ts
│  │  │  └─ render-public.ts
│  │  └─ write-xlsx.ts
├─ config/subjects.json         # 預設科目對應
├─ scripts/generate-sample.ts   # 範例資料產生器（固定 seed，可重現）
├─ sample-data/current/ , sample-data/previous/
├─ test/                        # 單元 + 整合 + 效能測試
├─ docs/DESIGN.md
└─ README.md
```

### 3.4 核心型別（草案）

```ts
type Score =
  | { kind: 'present'; tenths: number }   // 0..1000
  | { kind: 'absent' };

interface StudentRecord {
  studentId: string;        // 一律字串
  className: string;
  seat: string;
  name: string;
  scores: ReadonlyMap<SubjectName, Score>;
  source: { file: string; row: number };
}

interface ImportIssue {
  kind: 'invalid-score' | 'missing-id' | 'duplicate-id' | 'unknown-column' | 'file-error';
  file: string;
  row?: number;
  studentId?: string;
  related?: { file: string; row: number }[];   // 重複學號的另一個來源
  message: string;          // 例：「國文」分數 "八十" 無法解析
}
```

### 3.5 設定檔格式（`config/subjects.json`）

```json
{
  "subjects": [
    { "name": "國文", "aliases": ["國語文", "國語"] },
    { "name": "英語", "aliases": ["英文"] },
    { "name": "數學", "aliases": [] },
    { "name": "自然", "aliases": ["自然科學", "理化", "生物"] },
    { "name": "歷史", "aliases": [] },
    { "name": "地理", "aliases": [] },
    { "name": "公民", "aliases": ["公民與社會"] },
    { "name": "健康", "aliases": ["健康教育"] }
  ],
  "fields": {
    "className": ["班級", "班別"],
    "seat": ["座號"],
    "studentId": ["學號"],
    "name": ["姓名", "學生姓名"]
  },
  "ignoreColumns": ["總分", "平均", "名次", "備註"],
  "absentTokens": ["缺", "缺考"]
}
```

- 驗證：`subjects` 必須剛好 8 個、名稱與別名不得重複。
- 欄名比對前先 NFKC + 去空白。
- 不認得的欄 → `unknown-column` 檔案層級警告，不影響匯入。

### 3.6 CLI

```
exam-digest build <資料夾> [--prev <上次資料夾>] [--out <輸出資料夾>]
                           [--config <設定檔>] [--public]
```

| 參數 | 預設 | 說明 |
|---|---|---|
| `--out` | `./out` | 不存在則建立 |
| `--config` | 內建 `config/subjects.json` | |
| `--prev` | 無 | 有指定才產生比較區塊 |
| `--public` | false | 見 Q2 |

Exit code：`0` 成功（即使有列層級問題）、`1` 致命錯誤（資料夾不存在、設定檔錯、找不到任何檔案）、`2` 參數錯誤。執行結束在 stderr 印出摘要（匯入幾班幾人、幾個問題、輸出路徑、耗時）。

輸出檔：`exam-report.html`、`exam-scores.xlsx`；公開版 `exam-report-public.html`。

---

## 4. 技術選型

| 用途 | 選擇 | 理由 |
|---|---|---|
| 語言 | TypeScript strict，`tsc` 編譯到 `dist/` | `prepare` script 讓 `npm install` 後自動 build，符合「npm install + 一個指令」驗收 |
| CLI 參數 | Node 內建 `util.parseArgs` | 免裝 commander |
| 編碼偵測 | Node 內建 `TextDecoder('big5')` + `fatal: true` 的 UTF-8 | 免裝 iconv-lite（runtime） |
| CSV 解析 | `csv-parse`（sync API） | 處理引號、CRLF、欄內逗號等邊界情況，比自己寫可靠 |
| xlsx 讀寫 | **ExcelJS** | 讀寫同一套、MIT、在 npm 上。SheetJS 的 npm 版 `xlsx@0.18.5` 已停更且有已知漏洞，新版只能從 SheetJS 自家 CDN 安裝，不適合 |
| 範例資料 Big5 編碼 | `iconv-lite`（**僅 devDependency**） | Node 的 TextEncoder 只能編 UTF-8，產生 Big5 檔需要它 |
| HTML 模板 | Template literal + `escapeHtml` | 不引入模板引擎；跳脫函式有單元測試 |
| 圖表 | 自寫 SVG 字串產生器 | 長條圖 + 各班比較圖，題目要求 |
| 測試 / Lint | Vitest、ESLint flat config + typescript-eslint | 題目指定 |

新增 runtime 依賴只有 **ExcelJS、csv-parse** 兩個。

---

## 5. 範例資料設計（`scripts/generate-sample.ts`）

固定 seed 的 PRNG，每次產出一模一樣的檔案，產出物一併 commit。

| 班級 | 來源 | 格式 | 特徵 |
|---|---|---|---|
| 701–703 | 校務系統匯出 | CSV, **Big5** | 有班級欄、標準欄名、CRLF |
| 704–706 | 校務系統匯出 | xlsx | 有班級欄、標準欄名 |
| 707–708 | 導師 Excel 另存 | CSV, **Big5** | 無班級欄（從檔名取）、欄名用「國語文」「英文」 |
| 709 | 導師 Excel 另存 | CSV, **UTF-8 BOM** | 同上 + 全形數字 |
| 710–712 | 導師 Excel 另存 | xlsx | 學號為數字儲存格、多一欄「總分」公式、尾端空白列 |

刻意放入的異常：缺考（「缺」「缺考」、空白）、0 分、`101`、`-5`、`八十`、`85.55`、空學號、跨檔重複學號、上次有本次無（轉出）、本次有上次無（轉入）、含罕用字但仍在 Big5 範圍內的姓名。

上次段考：同樣 12 班，分數加上隨機漂移，並刻意讓少數學生大幅進退步，方便驗證前 10 名。

---

## 6. 測試計畫（目標 ≥ 35 個，題目要求 25）

| 模組 | 測試重點 | 對應驗收 |
|---|---|---|
| parse-score | 合法整數／一位小數、100、0、`101`、`-5`、`八十`、`85.55`、全形數字、缺／缺考／空白 | 錯誤分數列入清單 |
| map-headers | 「國語文」→ 國文、「英文」→ 英語、未知欄、缺必要欄 | 科目對應 |
| decode | UTF-8 BOM、無 BOM UTF-8、Big5 | 無亂碼 |
| normalize | 空學號、班級從檔名取得、列號正確、完全空白列略過 | 檔名＋列號 |
| dedupe | 跨檔重複列出兩個來源 | 重複學號 |
| descriptive / subject-stats | 30 人應考、2 缺考、1 個 0 分 → 實考 28、分母 28 | 缺考 vs 0 分 |
| ranking | 1、2、2、4 跳號；全部同分；手算 PR；PR 上限 99、下限 1；有缺考者不排名 | 排名、PR |
| distribution | 100 → 90–100、89.9 → 80–89.9、0、9.9、10 | 級距 |
| compare | 前 10 名進步／退步、轉入、轉出、資料錯誤不誤判轉學 | 比較 |
| redact / public HTML | 掃描輸出：所有姓名、所有完整學號都不存在 | 公開版 |
| HTML | 輸出不含 `http://`、`https://`、`<script src`、`<link` | 離線 |
| xlsx | 重新讀回，工作表數 = 班級數 + 1 | 總表 |
| 整合 | 對 sample-data 跑完整 build | 整體 |
| 效能 | 15 班 × 35 人 × 8 科 build < 10 秒 | 效能 |

---

## 7. 開發里程碑（每步都可編譯、可測試、獨立 commit）

| # | 內容 | 預估 |
|---|---|---|
| M0 | 專案骨架：git init、package.json、tsconfig strict、ESLint、Vitest、空 CLI | 1h |
| M1 | 設定檔 + 欄名對應 + 分數解析（TDD） | 2h |
| M2 | 編碼偵測、CSV／xlsx reader、normalize、dedupe | 4h |
| M3 | 範例資料產生器（提早做，後面整合測試要用） | 3h |
| M4 | 統計：科目統計、個人總分、排名＋PR、級距 | 3h |
| M5 | 與上次段考比較 | 2h |
| M6 | xlsx 總表輸出 | 2h |
| M7 | HTML 完整版 + SVG 圖表 | 4h |
| M8 | 公開版 + 去識別化測試 | 2h |
| M9 | CLI 收尾、效能測試、README、截圖 | 3h |
| | **合計** | **約 26h**（落在題目估計的 20–28h） |

---

## 8. 已決議事項（2026-10-19）

- **Q1 重複學號**：依檔名排序保留第一筆、跳過後面的，兩筆都列入問題清單，報表中保留的那位學生標示「學號重複」。
- **Q2 公開版**：只有統計與分布（年級總覽、各班比較、各科分布圖），完全不列學生層級清單；遮罩函式仍實作並測試，作為防線。`--public` 只產生公開版 HTML，不產生 xlsx。
- **Q3 標準差**：母體標準差 σ（除以 N）。
- **Q4 進步／退步**：照題目字面，兩次都出現的學生全部納入，表格中標示缺考科目數。

## 9. 已知限制（預計寫入 README）

- 只支援 `.csv`、`.xlsx`，不支援舊版 `.xls`。
- 導師若在 Excel 中把學號存成數字，前導 0 會遺失，工具無法還原（會照數字字串比對）。
- CSV 編碼只自動偵測 UTF-8 與 Big5。
- Big5 檔案若在導師端存檔前就已把罕用字變成「?」，工具無法還原。
- 一個檔案只能有一個工作表的資料（xlsx 只讀第一個工作表）。
