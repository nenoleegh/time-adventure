export function parseDelimitedText(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const delimiter = source.includes("\t")
    ? "\t"
    : source.includes(",")
      ? ","
      : null;
  if (!delimiter) {
    return source
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => line.trim().split(/\s{2,}/).map((cell) => cell.trim()));
  }

  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function rowsToTsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => String(value ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " / "))
        .join("\t"),
    )
    .join("\n");
}

function textFromElement(element) {
  return Array.from(element?.getElementsByTagName("t") || [], (node) => node.textContent).join("");
}

function columnIndex(reference) {
  const letters = String(reference || "").match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "";
  let value = 0;
  for (const letter of letters) value = value * 26 + (letter.charCodeAt(0) - 64);
  return Math.max(0, value - 1);
}

function excelValue(value) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0 && number < 1) {
    const totalMinutes = Math.round(number * 24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }
  return value;
}

export async function readXlsxRows(buffer) {
  if (!globalThis.JSZip) throw new Error("XLSX 解析组件没有加载，请刷新页面后重试。");
  const zip = await globalThis.JSZip.loadAsync(buffer);
  const sheetFiles = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => {
      const aNumber = Number(a.match(/sheet(\d+)/)?.[1] || 0);
      const bNumber = Number(b.match(/sheet(\d+)/)?.[1] || 0);
      return aNumber - bNumber;
    });
  if (!sheetFiles.length) throw new Error("这个文件里没有找到可读取的工作表。");

  let sharedStrings = [];
  if (zip.file("xl/sharedStrings.xml")) {
    const xml = await zip.file("xl/sharedStrings.xml").async("text");
    const document = new DOMParser().parseFromString(xml, "application/xml");
    sharedStrings = Array.from(document.getElementsByTagName("si"), textFromElement);
  }

  const sheetXml = await zip.file(sheetFiles[0]).async("text");
  const document = new DOMParser().parseFromString(sheetXml, "application/xml");
  const rows = [];
  for (const rowNode of document.getElementsByTagName("row")) {
    const row = [];
    for (const cellNode of rowNode.getElementsByTagName("c")) {
      const index = columnIndex(cellNode.getAttribute("r"));
      const type = cellNode.getAttribute("t");
      let value = "";
      if (type === "inlineStr") {
        value = textFromElement(cellNode);
      } else {
        value = cellNode.getElementsByTagName("v")[0]?.textContent || "";
        if (type === "s") value = sharedStrings[Number(value)] ?? "";
        else value = excelValue(value);
      }
      row[index] = value;
    }
    if (row.some((value) => String(value || "").trim())) {
      rows.push(Array.from(row, (value) => value ?? ""));
    }
  }
  return rows;
}

export async function readCourseSpreadsheet(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    return readXlsxRows(await file.arrayBuffer());
  }
  if (name.endsWith(".xls")) {
    throw new Error("暂不支持旧版 .xls 文件，请在 Excel 中另存为 .xlsx 或 CSV。");
  }
  return parseDelimitedText(await file.text());
}
