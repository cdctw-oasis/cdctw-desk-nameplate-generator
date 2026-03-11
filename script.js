const fields = {
  nameZh: document.getElementById("nameZh"),
  titleZh: document.getElementById("titleZh"),
  titleEn: document.getElementById("titleEn"),
};

const defaults = {
  nameZh: "疾管家",
  titleZh: "疾管署官方帳號",
  titleEn: "LINE Official Account of Centers for Disease Control",
  enFontSize: 44,
};

const preview = document.getElementById("preview");
const resetBtn = document.getElementById("resetBtn");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const printPdfBtn = document.getElementById("printPdfBtn");
const downloadSvgBtn = document.getElementById("downloadSvgBtn");
const enFontSizeInput = document.getElementById("enFontSize");
const enFontSizeDownBtn = document.getElementById("enFontSizeDownBtn");
const enFontSizeUpBtn = document.getElementById("enFontSizeUpBtn");
const enFontSizeValue = document.getElementById("enFontSizeValue");

const templateImagePath = "./nameplate-template.png";
const nameFontWeight = 1000;
const nameStrokeWidth = 1.8;
const titleZhFontWeight = 900;
const titleZhStrokeWidth = 0.8;
let template = {
  image: null,
  dataUrl: "",
  width: 1198,
  height: 465,
};

let currentSvg = "";
let currentData = { ...defaults };

const layout = {
  name: { x: 470, y: 170, base: 104, min: 62, startShrinkAt: 3, unitShrink: 11 },
  titleZh: { x: 470, y: 270, base: 56, min: 34, startShrinkAt: 10, unitShrink: 3.4 },
  en: {
    x: 470,
    y: 310,
    width: 610,
    base: 44,
    min: 26,
    controlMin: 26,
    controlMax: 60,
    startShrinkAt: 32,
    unitShrink: 0.9,
    lineHeightRatio: 1.35,
    maxHeight: 95,
  },
  justifyWidth: 600,
};

const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sizeByLength(text, baseSize, minSize, startShrinkAt, unitShrink) {
  if (text.length <= startShrinkAt) {
    return baseSize;
  }
  const overflow = text.length - startShrinkAt;
  return Math.max(minSize, Math.round(baseSize - overflow * unitShrink));
}

function fitFontSize(text, initialSize, minSize, weight, family, maxWidth) {
  if (!measureCtx || !text) {
    return initialSize;
  }

  let size = initialSize;
  while (size > minSize) {
    measureCtx.font = `${weight} ${size}px ${family}`;
    if (measureCtx.measureText(text).width <= maxWidth) {
      break;
    }
    size -= 1;
  }
  return size;
}

function computeLetterSpacing(text, font, targetWidth) {
  if (!measureCtx || !text) {
    return 0;
  }

  const chars = Array.from(text);
  if (chars.length < 2) {
    return 0;
  }

  measureCtx.font = font;
  const textWidth = measureCtx.measureText(text).width;
  const spacing = (targetWidth - textWidth) / (chars.length - 1);
  return Math.max(0, spacing);
}

function svgLetterSpacingStyle(text, spacing) {
  if (!text || Array.from(text).length < 2 || spacing <= 0) {
    return "";
  }
  return ` style="letter-spacing:${spacing.toFixed(2)}px"`;
}

function splitLongToken(token, maxWidth) {
  if (!measureCtx || !token) {
    return [token];
  }

  const chars = Array.from(token);
  const parts = [];
  let current = "";
  chars.forEach((char) => {
    const candidate = current + char;
    if (!current || measureCtx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      return;
    }
    parts.push(current);
    current = char;
  });
  if (current) {
    parts.push(current);
  }
  return parts;
}

function wrapLineByWidth(line, font, maxWidth) {
  if (!measureCtx) {
    return [line];
  }

  const normalized = (line || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [""];
  }

  measureCtx.font = font;
  const tokens = normalized.split(" ");
  const lines = [];
  let current = "";

  tokens.forEach((token) => {
    const candidate = current ? `${current} ${token}` : token;
    if (measureCtx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (measureCtx.measureText(token).width <= maxWidth) {
      current = token;
      return;
    }

    const parts = splitLongToken(token, maxWidth);
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current = part;
      } else {
        lines.push(part);
      }
    });
  });

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [" "];
}

function wrapTextByWidth(text, font, maxWidth) {
  const rawLines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const allLines = [];

  rawLines.forEach((line) => {
    const wrapped = wrapLineByWidth(line, font, maxWidth);
    allLines.push(...wrapped);
  });

  return allLines.length > 0 ? allLines : [""];
}

function computeEnglishLayout(text, scale = 1, preferredSize = layout.en.base) {
  const autoBase = sizeByLength(
    text,
    layout.en.base,
    layout.en.min,
    layout.en.startShrinkAt,
    layout.en.unitShrink
  );
  const boundedPreferred = Math.min(
    layout.en.controlMax,
    Math.max(layout.en.controlMin, preferredSize)
  );
  const enBase = Math.max(layout.en.min, autoBase + (boundedPreferred - layout.en.base));

  let fontSize = enBase;
  let lines = [" "];
  let lineHeight = Math.round(fontSize * layout.en.lineHeightRatio * scale);

  while (fontSize >= layout.en.min) {
    const scaledSize = fontSize * scale;
    const font = `700 ${scaledSize}px "Noto Sans TC","Segoe UI",sans-serif`;
    lines = wrapTextByWidth(text, font, layout.en.width * scale);
    lineHeight = Math.round(scaledSize * layout.en.lineHeightRatio);

    if (lines.length * lineHeight <= layout.en.maxHeight * scale) {
      break;
    }
    fontSize -= 1;
  }

  return {
    fontSize: fontSize * scale,
    lineHeight,
    lines,
  };
}

function computeFontSizes(data) {
  const nameBase = sizeByLength(
    data.nameZh,
    layout.name.base,
    layout.name.min,
    layout.name.startShrinkAt,
    layout.name.unitShrink
  );
  const titleBase = sizeByLength(
    data.titleZh,
    layout.titleZh.base,
    layout.titleZh.min,
    layout.titleZh.startShrinkAt,
    layout.titleZh.unitShrink
  );

  return {
    nameSize: fitFontSize(
      data.nameZh,
      nameBase,
      layout.name.min,
      nameFontWeight,
      '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif',
      layout.justifyWidth * 0.96
    ),
    titleSize: fitFontSize(
      data.titleZh,
      titleBase,
      layout.titleZh.min,
      titleZhFontWeight,
      '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif',
      layout.justifyWidth * 0.98
    ),
  };
}

function buildSvg(data) {
  if (!template.image) {
    return "";
  }

  const safeNameZh = escapeXml(data.nameZh || " ");
  const safeTitleZh = escapeXml(data.titleZh || " ");
  const fonts = computeFontSizes(data);
  const en = computeEnglishLayout(data.titleEn, 1, data.enFontSize);
  const imageHref = template.dataUrl || templateImagePath;
  const nameSpacing = computeLetterSpacing(
    data.nameZh,
    `${nameFontWeight} ${fonts.nameSize}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`,
    layout.justifyWidth
  );
  const titleSpacing = computeLetterSpacing(
    data.titleZh,
    `${titleZhFontWeight} ${fonts.titleSize}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`,
    layout.justifyWidth
  );
  const nameSpacingStyle = svgLetterSpacingStyle(data.nameZh, nameSpacing);
  const titleSpacingStyle = svgLetterSpacingStyle(data.titleZh, titleSpacing);
  const enLines = en.lines
    .map((line, index) => {
      const y = layout.en.y + index * en.lineHeight;
      return `<text x="${layout.en.x}" y="${y}" class="title-en" font-size="${en.fontSize}" font-weight="700" dominant-baseline="hanging">${escapeXml(line)}</text>`;
    })
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${template.width} ${template.height}" role="img" aria-label="CDC 辦公室名牌">
  <defs>
    <style>
      .name { font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif; fill: #19883D; stroke: #19883D; stroke-width: ${nameStrokeWidth}px; paint-order: stroke fill; }
      .title-zh { font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif; fill: #267239; stroke: #267239; stroke-width: ${titleZhStrokeWidth}px; paint-order: stroke fill; }
      .title-en { font-family: "Noto Sans TC", "Segoe UI", sans-serif; fill: #267239; }
    </style>
  </defs>
  <image x="0" y="0" width="${template.width}" height="${template.height}" href="${imageHref}" />
  <text x="${layout.name.x}" y="${layout.name.y}" class="name" font-size="${fonts.nameSize}" font-weight="${nameFontWeight}"${nameSpacingStyle}>${safeNameZh}</text>
  <text x="${layout.titleZh.x}" y="${layout.titleZh.y}" class="title-zh" font-size="${fonts.titleSize}" font-weight="${titleZhFontWeight}"${titleSpacingStyle}>${safeTitleZh}</text>
  ${enLines}
</svg>`;
}

function getData() {
  return {
    nameZh: fields.nameZh.value.trim(),
    titleZh: fields.titleZh.value.trim(),
    titleEn: fields.titleEn.value.replace(/\r\n/g, "\n"),
    enFontSize: Number(enFontSizeInput.value) || layout.en.base,
  };
}

function render() {
  currentData = getData();
  currentSvg = buildSvg(currentData);
  preview.innerHTML = currentSvg || "";
}

function updateEnFontSizeLabel() {
  enFontSizeValue.textContent = `${enFontSizeInput.value} px`;
}

function setEnglishFontSize(nextValue) {
  const min = Number(enFontSizeInput.min);
  const max = Number(enFontSizeInput.max);
  const clamped = Math.min(max, Math.max(min, Math.round(nextValue)));
  enFontSizeInput.value = String(clamped);
  updateEnFontSizeLabel();
  render();
}

function drawSpacedText(ctx, text, x, y, spacing, stroke = false) {
  const chars = Array.from(text || " ");
  if (chars.length < 2) {
    if (stroke) {
      ctx.strokeText(chars.join(""), x, y);
    } else {
      ctx.fillText(chars.join(""), x, y);
    }
    return;
  }

  let cursor = x;

  chars.forEach((char, index) => {
    const width = ctx.measureText(char).width;
    if (stroke) {
      ctx.strokeText(char, cursor, y);
    } else {
      ctx.fillText(char, cursor, y);
    }
    cursor += width + spacing;
  });
}

function renderToCanvas(scale = 2) {
  if (!template.image) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(template.width * scale);
  canvas.height = Math.round(template.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(template.image, 0, 0, canvas.width, canvas.height);

  const fonts = computeFontSizes(currentData);
  const en = computeEnglishLayout(currentData.titleEn, scale, currentData.enFontSize);
  const nameSpacing = computeLetterSpacing(
    currentData.nameZh,
    `${nameFontWeight} ${fonts.nameSize * scale}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`,
    layout.justifyWidth * scale
  );
  const titleSpacing = computeLetterSpacing(
    currentData.titleZh,
    `${titleZhFontWeight} ${fonts.titleSize * scale}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`,
    layout.justifyWidth * scale
  );

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#19883D";
  ctx.font = `${nameFontWeight} ${Math.round(fonts.nameSize * scale)}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`;
  ctx.strokeStyle = "#19883D";
  ctx.lineWidth = nameStrokeWidth * scale;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  drawSpacedText(
    ctx,
    currentData.nameZh || " ",
    layout.name.x * scale,
    layout.name.y * scale,
    nameSpacing,
    true
  );
  drawSpacedText(
    ctx,
    currentData.nameZh || " ",
    layout.name.x * scale,
    layout.name.y * scale,
    nameSpacing
  );

  ctx.fillStyle = "#267239";
  ctx.font = `${titleZhFontWeight} ${Math.round(fonts.titleSize * scale)}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`;
  ctx.strokeStyle = "#267239";
  ctx.lineWidth = titleZhStrokeWidth * scale;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  drawSpacedText(
    ctx,
    currentData.titleZh || " ",
    layout.titleZh.x * scale,
    layout.titleZh.y * scale,
    titleSpacing,
    true
  );
  drawSpacedText(
    ctx,
    currentData.titleZh || " ",
    layout.titleZh.x * scale,
    layout.titleZh.y * scale,
    titleSpacing
  );

  ctx.fillStyle = "#267239";
  ctx.textBaseline = "top";
  ctx.font = `700 ${Math.round(en.fontSize)}px "Noto Sans TC","Segoe UI",sans-serif`;
  en.lines.forEach((line, index) => {
    const y = layout.en.y * scale + index * en.lineHeight;
    ctx.fillText(line, layout.en.x * scale, y);
  });

  return canvas;
}

function asciiBytes(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function cmToPt(cm) {
  return (cm * 72) / 2.54;
}

function buildPdfFromJpeg(
  jpegBytes,
  imageWidth,
  imageHeight,
  pageWidth,
  pageHeight,
  drawWidth,
  drawHeight,
  offsetX,
  offsetY
) {
  const chunks = [];
  const offsets = [0];
  let currentOffset = 0;

  function push(chunk) {
    chunks.push(chunk);
    currentOffset += chunk.length;
  }

  function pushText(text) {
    push(asciiBytes(text));
  }

  function writeObject(objectId, bodyBuilder) {
    offsets[objectId] = currentOffset;
    pushText(`${objectId} 0 obj\n`);
    bodyBuilder();
    pushText(`\nendobj\n`);
  }

  pushText("%PDF-1.4\n%\xff\xff\xff\xff\n");

  const contentStream = `q\n${drawWidth.toFixed(3)} 0 0 ${drawHeight.toFixed(3)} ${offsetX.toFixed(3)} ${offsetY.toFixed(3)} cm\n/Im0 Do\nQ\n`;
  const contentBytes = asciiBytes(contentStream);

  writeObject(1, () => {
    pushText("<< /Type /Catalog /Pages 2 0 R >>");
  });

  writeObject(2, () => {
    pushText("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  });

  writeObject(3, () => {
    pushText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(3)} ${pageHeight.toFixed(3)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
    );
  });

  writeObject(4, () => {
    pushText(
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    push(jpegBytes);
    pushText("\nendstream");
  });

  writeObject(5, () => {
    pushText(`<< /Length ${contentBytes.length} >>\nstream\n`);
    push(contentBytes);
    pushText("endstream");
  });

  const xrefOffset = currentOffset;
  pushText("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i += 1) {
    pushText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatBytes(chunks);
}

function downloadSvg() {
  if (!currentSvg) {
    return;
  }

  const blob = new Blob([currentSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cdc-nameplate.svg";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadPng() {
  const canvas = renderToCanvas(2);
  if (!canvas) {
    return;
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    const pngUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = "cdc-nameplate.png";
    link.click();
    URL.revokeObjectURL(pngUrl);
  }, "image/png");
}

function createPdfBlob(pageWidthPt, pageHeightPt) {
  const canvas = renderToCanvas(2);
  if (!canvas) {
    return null;
  }

  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.98);
  const base64 = jpegDataUrl.split(",")[1];
  if (!base64) {
    return null;
  }

  const jpegBytes = base64ToBytes(base64);
  const imageAspect = canvas.width / canvas.height;
  const pageAspect = pageWidthPt / pageHeightPt;

  let drawWidthPt = pageWidthPt;
  let drawHeightPt = pageHeightPt;
  if (imageAspect > pageAspect) {
    drawHeightPt = drawWidthPt / imageAspect;
  } else {
    drawWidthPt = drawHeightPt * imageAspect;
  }

  const offsetXPt = (pageWidthPt - drawWidthPt) / 2;
  const offsetYPt = (pageHeightPt - drawHeightPt) / 2;

  const pdfBytes = buildPdfFromJpeg(
    jpegBytes,
    canvas.width,
    canvas.height,
    pageWidthPt,
    pageHeightPt,
    drawWidthPt,
    drawHeightPt,
    offsetXPt,
    offsetYPt
  );
  return new Blob([pdfBytes], { type: "application/pdf" });
}

function downloadPdf() {
  const blob = createPdfBlob(cmToPt(20), cmToPt(7.5));
  if (!blob) {
    return;
  }

  const pdfUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = pdfUrl;
  link.download = "cdc-nameplate.pdf";
  link.click();
  URL.revokeObjectURL(pdfUrl);
}

function createPdfBlobA4Landscape() {
  const canvas = renderToCanvas(2);
  if (!canvas) {
    return null;
  }

  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.98);
  const base64 = jpegDataUrl.split(",")[1];
  if (!base64) {
    return null;
  }

  const jpegBytes = base64ToBytes(base64);

  // A4 橫式頁面
  const pageWidthPt = cmToPt(29.7);
  const pageHeightPt = cmToPt(21);

  // 名牌以實際尺寸 20×7.5cm 置中
  const drawWidthPt = cmToPt(20);
  const drawHeightPt = cmToPt(7.5);
  const offsetXPt = (pageWidthPt - drawWidthPt) / 2;
  const offsetYPt = (pageHeightPt - drawHeightPt) / 2;

  const pdfBytes = buildPdfFromJpeg(
    jpegBytes,
    canvas.width,
    canvas.height,
    pageWidthPt,
    pageHeightPt,
    drawWidthPt,
    drawHeightPt,
    offsetXPt,
    offsetYPt
  );
  return new Blob([pdfBytes], { type: "application/pdf" });
}

function printPdfA4Landscape() {
  const blob = createPdfBlobA4Landscape();
  if (!blob) {
    return;
  }

  const pdfUrl = URL.createObjectURL(blob);
  const opened = window.open(pdfUrl, "_blank");
  if (!opened) {
    window.alert("彈出視窗遭封鎖，請允許本頁面顯示彈出視窗後再試一次。");
    URL.revokeObjectURL(pdfUrl);
    return;
  }

  setTimeout(() => URL.revokeObjectURL(pdfUrl), 10 * 60 * 1000);
}

function loadTemplate() {
  return new Promise((resolve, reject) => {
  const image = new Image();
    image.onload = () => {
      template.image = image;
      template.width = image.width;
      template.height = image.height;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(image, 0, 0);
          template.dataUrl = canvas.toDataURL("image/png");
        }
      } catch {
        template.dataUrl = "";
      }

      resolve();
    };
    image.onerror = () => reject(new Error("Template image decode failed."));
    image.src = templateImagePath;
  });
}

Object.values(fields).forEach((input) => {
  input.addEventListener("input", render);
});

enFontSizeInput.addEventListener("input", () => {
  updateEnFontSizeLabel();
  render();
});

enFontSizeDownBtn.addEventListener("click", () => {
  setEnglishFontSize(Number(enFontSizeInput.value) - 1);
});

enFontSizeUpBtn.addEventListener("click", () => {
  setEnglishFontSize(Number(enFontSizeInput.value) + 1);
});

resetBtn.addEventListener("click", () => {
  fields.nameZh.value = defaults.nameZh;
  fields.titleZh.value = defaults.titleZh;
  fields.titleEn.value = defaults.titleEn;
  enFontSizeInput.value = String(defaults.enFontSize);
  updateEnFontSizeLabel();
  render();
});

downloadPngBtn.addEventListener("click", downloadPng);
downloadPdfBtn.addEventListener("click", downloadPdf);
printPdfBtn.addEventListener("click", printPdfA4Landscape);
downloadSvgBtn.addEventListener("click", downloadSvg);

loadTemplate()
  .then(() => {
    enFontSizeInput.value = String(defaults.enFontSize);
    updateEnFontSizeLabel();
    render();
  })
  .catch(() => {
    preview.innerHTML = "<p>模板載入失敗，請確認 `nameplate-template.png` 存在。</p>";
  });
