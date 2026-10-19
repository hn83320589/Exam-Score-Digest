# 測試報告 — Exam Score Digest

| 項目 | 內容 |
|---|---|
| 測試日期 | 2026-10-19 |
| 受測版本 | commit `3b9d226`（`main`）；之後的 commit 只新增本報告與 README 連結，不含程式變更 |
| 測試環境 | macOS（Darwin 27）、Chromium（Playwright） |
| Node.js | v26.9.0（開發機）、**v22.23.3**（22 LTS，另行驗證） |
| npm | 11.19.1 |
| 結論 | **驗收標準 15 項全部通過**；1 項（以 Microsoft Excel 實際開啟 .xlsx）因環境限制改以替代方式驗證，見〈未能直接驗證的項目〉 |

## 1. 測試方法

為了避免「用同一套程式驗證自己」，驗收以三層方式進行：

| 層級 | 方式 | 指令 |
|---|---|---|
| 單元／整合測試 | Vitest，140 個測試，涵蓋各計算規則（手算資料）與範例資料的整合測試 | `npm test` |
| 黑箱驗收腳本 | 執行**已編譯的 CLI**，從輸出的 HTML 與 xlsx **獨立重算**排名、PR、進步退步榜；原始檔改用 iconv-lite 獨立解碼比對姓名。腳本不 import `src/` 的任何程式 | `npm run build && npm run verify` |
| 實機檢查 | 乾淨 clone + `npm ci`、Node 22 重跑、Chromium 離線開啟報表、xlsx XML 結構檢查 | 見第 4 節 |

所有測試都在**全新 clone 的 repo** 中執行（`git clone` → `npm ci`），確認不依賴開發機上的任何殘留檔案。

## 2. 驗收標準逐項結果

| # | 驗收標準 | 結果 | 驗證方式與證據 |
|---|---|---|---|
| 1 | 依 README 執行 `npm install` 與一個 CLI 指令，即可用範例資料產出 HTML 報表與 .xlsx 總表 | ✅ | 全新 clone 執行 `npm ci` 後 `npx exam-digest build sample-data/current --prev sample-data/previous --out out`，exit 0，產出 `exam-report.html`、`exam-scores.xlsx`（驗收腳本 A1） |
| 2 | 兩種來源（校務系統匯出、導師 Excel 另存）都能正確匯入；所有姓名完整顯示，沒有亂碼或問號 | ✅ | 12 個檔案（Big5 CSV、UTF-8 BOM CSV、xlsx）全部匯入；以 iconv-lite 獨立解碼原始檔得到 361 位姓名，報表中缺少 0 位、含 `?` 或 `U+FFFD` 者 0 位（A2）；瀏覽器中頁面文字的 `U+FFFD` 為 0 |
| 3 | 「國語文」與「國文」合併為同一科，並有單元測試 | ✅ | `map-headers.test.ts`「「國語文」與「國文」對應到同一個標準科目」 |
| 4 | 某科 30 人應考、2 人缺考、1 人 0 分時，實考 28 人、平均分母為 28，需有單元測試 | ✅ | `stats.test.ts`「30 人應考、2 人缺考、1 人 0 分 → 實考 28 人，平均分母為 28」（27×70+0 / 28 = 67.5，若誤把缺考當 0 分會得到 63）；`parse-score.test.ts`「0 分與缺考是不同結果」 |
| 5 | 分數 101、-5、「八十」、空學號的列都出現在匯入問題清單，並附檔名與列號 | ✅ | 報表中：`701.csv` 第 9 列（101）、`706.xlsx` 第 5 列（-5）、`708.csv` 第 11 列（八十）、`709.csv` 第 13 列（缺少學號）（A5）；單元測試 `normalize.test.ts` |
| 6 | 學號跨檔重複時，問題清單列出兩個來源檔案與列號 | ✅ | `711.xlsx` 第 16 列 ↔ `707.csv` 第 16 列，學號 1120715（A6）；`dedupe.test.ts` |
| 7 | 同分同名次與跳號、PR 值公式與上下限都有單元測試，並以手算資料驗證 | ✅ | `ranking.test.ts`：`[90,85,85,80]` → 名次 1、2、2、4，PR 88、50、50、13（87.5 與 12.5 四捨五入）；三人同分跳兩號；PR 上限 99（99.95）、下限 1（0.25）；全部同分 PR 50。另以範例資料輸出的總表獨立重算 351 人：名次不符 0、PR 不符 0，含 70 組同分（A7） |
| 8 | 有缺考科目的學生不參與排名，另外列在報表中 | ✅ | 範例中 4 位缺考學生在總表中名次與 PR 皆為空白，並列於報表「有缺考科目的學生」（A8）；`ranking.test.ts` |
| 9 | 100 分歸入 90–100、89.9 分歸入 80–89，並有單元測試 | ✅ | `distribution.test.ts`：0、9.9、10、59.9、60、89.9、90、100 各自的級距，以及標籤與邊界說明 |
| 10 | 進步、退步前 10 名正確；轉入、轉出有標示，並有單元測試 | ✅ | `compare.test.ts` 8 個測試；以兩次段考各自產出的總表獨立重算，進步榜與退步榜各 10 人的順序與報表一致；轉入 1129001、1129002，轉出 1120330、1120930（A10） |
| 11 | 拔掉網路後 HTML 報表仍可完整顯示（含圖表）；原始碼中搜尋不到網址（http／https）的外部資源引用 | ✅ | Chromium 設為離線（`navigator.onLine = false`）後載入兩份報表：網路請求 0 筆、失敗請求 0 筆，9 張 SVG 皆有實際尺寸、共 76 根長條（截圖 `docs/screenshots/offline-check.png`）；報表中 `<script>`、`<link>`、`@import`、`url()`、網址皆為 0；`src`、`config`、`scripts` 共 36 個檔案含網址 0 個（A11、`no-external-urls.test.ts`） |
| 12 | 公開版報表中搜尋不到任何學生姓名與完整學號，並有自動化測試檢查輸出內容 | ✅ | 比對兩次段考原始檔的 342 個姓名、364 個學號（含因資料錯誤被跳過的列），公開版中出現 0 個；`--public` 只輸出 `exam-report-public.html`（A12）；`build.test.ts` 讀取實際寫出的檔案檢查 |
| 13 | .xlsx 總表可用 Excel 正常開啟，工作表數量為班級數加 1 | ✅ ⚠️ | 13 個工作表（全年級 + 701–712）（A13）；解開 zip 後 20 個 XML 檔皆通過 `xmllint` well-formed 檢查。**未以 Microsoft Excel 實際開啟**，見第 5 節 |
| 14 | 匯入 12 班、每班 30 人、8 科，從執行指令到產出報表在 10 秒內完成 | ✅ | 範例資料（含上次段考比較、含 Node 啟動）0.20 秒（A14）；資料量上限 15 班 × 35 人 × 8 科（含比較）的效能測試 0.2 秒 |
| 15 | 單元測試至少 25 個，`npm test` 全數通過，`npm run lint` 沒有錯誤 | ✅ | 140 個測試、22 個測試檔，全數通過；ESLint（typescript-eslint `strictTypeChecked`）0 錯誤、0 警告；`tsc --noEmit` 0 錯誤 |

### 黑箱驗收腳本輸出（全新 clone，`npm run verify`）

| 編號 | 驗收項目 | 結果 | 證據 |
|---|---|---|---|
| A1 | npm install 後一個 CLI 指令即可產出 HTML 報表與 .xlsx 總表 | ✅ 通過 | 輸出檔：exam-report.html、exam-scores.xlsx |
| A2 | 兩種來源的檔案都能匯入，所有姓名完整顯示、沒有亂碼或問號 | ✅ 通過 | 原始檔（以 iconv-lite 獨立解碼）共 361 位姓名，報表中缺少 0 位；含 ? 或 U+FFFD 的姓名 0 位 |
| A5 | 分數 101、-5、「八十」、空學號的列都出現在匯入問題清單，並附檔名與列號 | ✅ 通過 | 找到 4/4：701.csv 第 9 列、706.xlsx 第 5 列、708.csv 第 11 列、709.csv 第 13 列 |
| A6 | 學號跨檔重複時，問題清單列出兩個來源檔案與列號 | ✅ 通過 | 711.xlsx 第 16 列（學號 1120715）↔ 707.csv 第 16 列 |
| A7 | 同分同名次與跳號、PR 值公式與上下限（以輸出總表獨立重算比對） | ✅ 通過 | 351 位參與排名者：名次不符 0、PR 不符 0；範例中有 70 組同分名次 |
| A8 | 有缺考科目的學生不參與排名，另外列在報表中 | ✅ 通過 | 缺考學生 4 位（1120205、1120206、1120207、1120903），皆無名次／PR，且列於「有缺考科目的學生」 |
| A10 | 與上次段考比較：進步、退步前 10 名正確，轉入、轉出有標示 | ✅ 通過 | 進步榜 10 人、退步榜 10 人與獨立重算一致；轉入 1129001、1129002；轉出 1120330、1120930 |
| A11 | HTML 報表不引用外部資源；原始碼中搜尋不到任何網址（http／https） | ✅ 通過 | 報表中 script／link／@import／url()／網址皆為 0；36 個原始碼檔案中含網址 0 個；內嵌 SVG 9 張 |
| A12 | 公開版報表中搜尋不到任何學生姓名與完整學號 | ✅ 通過 | 比對兩次段考原始檔中 342 個姓名、364 個學號：外洩 0；公開模式只輸出 exam-report-public.html |
| A13 | .xlsx 總表的工作表數量為班級數加 1 | ✅ 通過 | 工作表：全年級、701、702、703、704、705、706、707、708、709、710、711、712 |
| A14 | 範例資料（12 班）從執行指令到產出報表在 10 秒內完成 | ✅ 通過 | 含 Node 啟動，完整版（含比較）0.20 秒 |

全部通過（11/11）

## 3. 交付物檢查

| 交付物 | 結果 | 位置 |
|---|---|---|
| 原始碼、`package.json`、lockfile | ✅ | `src/`、`package.json`、`package-lock.json` |
| README：安裝與使用方式、CLI 參數 | ✅ | `README.md`〈安裝與使用〉〈CLI 參數〉 |
| README：科目對應設定檔格式 | ✅ | 〈科目對應設定檔〉 |
| README：缺考、排名、PR 值、級距的計算規則 | ✅ | 〈計算規則〉 |
| README：報表截圖（完整版與公開版各一） | ✅ | `docs/screenshots/report-full.png`、`report-public.png`（另有比較／問題清單截圖） |
| README：已知限制 | ✅ | 〈已知限制〉 |
| 範例資料：本次 12 班、約 30 人、8 科，混合 CSV／xlsx 與兩種來源 | ✅ | `sample-data/current/`（12 檔：校務系統 Big5 CSV ×3、xlsx ×3；導師另存 Big5 CSV ×2、UTF-8 BOM CSV ×1、xlsx ×3） |
| 範例資料：上次段考一份 | ✅ | `sample-data/previous/` |
| 範例資料：刻意放入缺考、0 分、錯誤分數、重複學號、轉入轉出 | ✅ | 見 README〈範例資料〉 |
| 範例資料產生腳本 | ✅ | `scripts/generate-sample.ts`（`npm run sample`） |
| Vitest 測試 | ✅ | `test/`（22 個檔案、140 個測試） |

技術限制同時確認：TypeScript `strict`（另開 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`）、CLI 介面、以 ExcelJS 讀寫 Excel、圖表自行產生 SVG、無資料庫、無 Docker。

## 4. 實機檢查紀錄

| 檢查 | 結果 |
|---|---|
| 全新 clone → `npm ci`（Node 26） | exit 0，約 2 秒；`prepare` 自動編譯出 `dist/` |
| 全新 clone → `npm ci` + `npm test` + `npm run lint` + CLI + `npm run verify`（**Node 22.23.3**） | 全部通過：140/140、lint 0 錯誤、CLI exit 0、驗收腳本 11/11 |
| Chromium 離線開啟完整版與公開版 | 網路請求 0 筆；完整版 6 個區塊、公開版 3 個區塊皆正常顯示；SVG 9/9 有實際尺寸 |
| xlsx 結構 | 20 個 XML 檔通過 `xmllint`；工作表 13 個 |
| 錯誤處理 | 參數錯誤 exit 2 並印出用法；資料夾不存在 exit 1 並印出路徑（`main.test.ts`） |

## 5. 未能直接驗證的項目

| 項目 | 原因 | 替代驗證 | 建議 |
|---|---|---|---|
| 以 Microsoft Excel 實際開啟 `exam-scores.xlsx` | 測試機沒有安裝 Excel／LibreOffice | ExcelJS 讀回比對內容；解開 zip 後以 `xmllint` 確認所有 XML 檔格式正確 | 交付前在 Windows 上以 Excel 開啟一次 |
| Windows 上的實際執行與 Edge 瀏覽器 | 測試機為 macOS，瀏覽器僅 Chromium | **已由 CI 補上 Windows 執行**（見第 8 節）：`windows-latest` × Node 22／24 的 `npm ci`、lint、typecheck、test、黑箱驗收全數通過。Edge 與 Chrome 同為 Chromium 核心 | 在繁中 Windows 上以 Edge 開啟一次報表 |
| 真實校務系統匯出的檔案 | 沒有取得真實檔案 | 範例資料模擬 Big5（CP950）CSV 與 xlsx 兩種格式 | 取得一份真實匯出檔試跑，確認欄名都在設定檔的別名內 |

## 6. 測試過程中發現並修正的問題

| 問題 | 發現方式 | 處理 |
|---|---|---|
| 學號空白或誤植的學生在比較中被誤判為「轉出」 | 以範例資料產生報表、人工檢視 | 列層級問題記錄班級與座號，另一次同班同座號的資料列有錯誤時標示「無法比較」（commit `ac06396`） |
| 驗收腳本的項目標題含網址字樣，被「原始碼不含網址」測試判為違規 | 在全新 clone 中執行 `npm test` | 改寫標題文字（commit `3b9d226`） |
| 長條圖在寬螢幕被放大、數值標籤與參考線重疊 | 截圖檢視 | SVG 改用原始尺寸、參考線置於底層、標籤加背景色描邊 |

## 7. 重現方式

```bash
git clone <repo> && cd Exam-Score-Digest
npm ci
npm test          # 140 個單元與整合測試
npm run lint      # ESLint
npm run verify    # 黑箱驗收腳本（需先 npm run build；npm ci 已自動 build）
```

## 8. 外部 code review 後的修正（追加）

交付後收到的 code review 指出三個實際資料上會出現的問題，均已修正並補上測試：

| 問題 | 影響 | 修正 | 測試 |
|---|---|---|---|
| 來源檔中的姓名已損壞（Excel 以 ANSI 另存時罕用字變成「?」、CP950 造字 `0xFA40` 解碼為私用區 U+E000）時，工具沒有任何警告 | 驗收第 2 條「沒有亂碼或問號」在真實資料上會失守；造字在沒有造字檔的電腦上顯示為方框 | 新增問題類型「姓名含無法辨識的字元」：資料照常匯入，問題清單中提示改用 CSV UTF-8 或 .xlsx 重新匯出；這類警告不影響比較功能的轉學判斷 | `normalize.test.ts`（?、U+E000、U+FFFD、罕用字不誤報）；`import-folder.test.ts` 以實際 CP950 位元組（含 `0xFA40`）重現 |
| xlsx 中有公式但沒有快取計算結果的儲存格被讀成空白 | 依規則被視為缺考，有分數的學生被靜默排除在排名之外 | 科目欄遇到這種儲存格時列為分數錯誤，提示在 Excel 開啟後重新存檔；非科目欄（如總分公式欄）不受影響 | `read-table.test.ts`、`normalize.test.ts` |
| Excel「Unicode 文字」（UTF-16）改副檔名為 .csv 時，只顯示「缺少必要欄位」 | 錯誤訊息對老師沒有幫助 | 以 UTF-16 BOM 辨識，提示改存為 CSV UTF-8 | `decode.test.ts`（LE／BE） |

另外補上 `LICENSE`（MIT）與 GitHub Actions CI。

### CI 結果（commit `2dda0b4`）

| 環境 | npm ci | lint | typecheck | test | 黑箱驗收 |
|---|---|---|---|---|---|
| ubuntu-latest / Node 22 | ✅ | ✅ | ✅ | ✅ | ✅ |
| ubuntu-latest / Node 24 | ✅ | ✅ | ✅ | ✅ | ✅ |
| windows-latest / Node 22 | ✅ | ✅ | ✅ | ✅ | ✅ |
| windows-latest / Node 24 | ✅ | ✅ | ✅ | ✅ | ✅ |

修正後測試數為 150 個，範例資料的驗收結果不變（11/11，匯入問題仍為 6 筆）。
