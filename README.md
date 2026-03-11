# 衛福部疾管署 CDC 辦公室 OA 屏風名牌產生器

衛福部疾管署辦公室 OA 屏風桌牌的線上產生器，固定版面，僅需編輯文字欄位即可產出可列印的名牌檔案。

## 功能

- 即時預覽：編輯即更新，所見即所得
- 中文姓名、中文職稱、英文職稱三欄自由編輯
- 英文職稱支援手動換行，超寬自動折行
- 英文職稱字級可透過滑桿或 +/- 按鈕調整
- 文字過長時自動縮小字級，確保不超出版面

## 輸出格式

| 按鈕          | 說明                                            |
| ------------- | ----------------------------------------------- |
| 下載 PNG      | 高解析度點陣圖（2× 縮放）                      |
| 下載 SVG      | 可縮放向量格式                                  |
| 下載 PDF      | 名牌實際尺寸（**20 × 7.5 cm**）          |
| 開啟 PDF 列印 | A4 橫式 PDF，名牌置中於頁面，適合直接列印後裁切 |

## 列印說明

1. 點擊「開啟 PDF 列印」，PDF 將在新分頁開啟
2. 於 PDF 檢視器中選擇 **A4 橫式** 列印，比例設為 **100%（實際大小）**
3. 列印後，**沿四邊黑色粗線的內緣裁切**，即可取得 20 × 7.5 cm 桌牌

> 若直接下載 PDF 自行列印，請同樣選擇 A4 橫式並設為實際大小。

## 使用方式

直接用瀏覽器開啟 `index.html`，無需安裝任何套件或伺服器。

## 更新模板底圖

若替換了 `name-temp.pdf`，請在專案目錄執行以下指令重新產出底圖：

```bash
pdftoppm -f 1 -singlefile -png -rx 150 -ry 150 name-temp.pdf name-temp-preview
convert name-temp-preview.png -trim +repage nameplate-template.png
```

## 檔案結構

```
cdc-desk-nameplate/
├── index.html               # 主頁面
├── styles.css               # 樣式
├── script.js                # 邏輯（SVG 產生、PDF 輸出、Canvas 渲染）
├── nameplate-template.png   # 名牌底圖（由 name-temp.pdf 轉出）
└── name-temp.pdf            # 底圖原始檔
```

## 授權

[MIT License](LICENSE) © 2026 衛生福利部疾病管制署
