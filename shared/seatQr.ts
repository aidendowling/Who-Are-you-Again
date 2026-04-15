import QRCode from "qrcode-terminal/vendor/QRCode";
import QRErrorCorrectLevel from "qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel";
import {
    buildSeatManifest,
    LayoutConfig,
    RoomSeat,
    sortSeatsByPosition,
} from "./classroom";

export const DEFAULT_SEAT_QR_BASE_URL = "https://app.whoru.edu/checkin";
const DEFAULT_MODULE_SIZE = 8;
const DEFAULT_QUIET_ZONE_MODULES = 4;

export type QrErrorLevel = keyof typeof QRErrorCorrectLevel;

export interface SeatQrManifestEntry extends RoomSeat {
    qrUrl: string;
    fileName: string;
}

export interface TeacherQrAsset {
    roomId: string;
    label: string;
    qrUrl: string;
    fileName: string;
}

export interface SeatQrSvgOptions {
    moduleSize?: number;
    quietZoneModules?: number;
    foregroundColor?: string;
    backgroundColor?: string;
    errorLevel?: QrErrorLevel;
}

function sanitizeFileToken(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function createSeatQrUrl(baseUrl: string, tagId: string) {
    const url = new URL(baseUrl);
    url.searchParams.set("t", tagId);
    return url.toString();
}

export function createTeacherQrUrl(baseUrl: string, roomId: string) {
    const url = new URL(baseUrl);
    url.searchParams.set("mode", "professor");
    url.searchParams.set("roomId", roomId);
    return url.toString();
}

export function createQrMatrix(value: string, errorLevel: QrErrorLevel = "M") {
    const qrcode = new QRCode(-1, QRErrorCorrectLevel[errorLevel]);
    qrcode.addData(value);
    qrcode.make();
    return qrcode.modules.map((row: boolean[]) => row.slice());
}

export function renderQrSvg(value: string, options: SeatQrSvgOptions = {}) {
    const matrix = createQrMatrix(value, options.errorLevel ?? "M");
    const moduleSize = options.moduleSize ?? DEFAULT_MODULE_SIZE;
    const quietZoneModules = options.quietZoneModules ?? DEFAULT_QUIET_ZONE_MODULES;
    const foregroundColor = options.foregroundColor ?? "#000000";
    const backgroundColor = options.backgroundColor ?? "#ffffff";
    const moduleCount = matrix.length;
    const qrSize = (moduleCount + quietZoneModules * 2) * moduleSize;
    const pathData: string[] = [];

    for (let rowIndex = 0; rowIndex < moduleCount; rowIndex += 1) {
        for (let colIndex = 0; colIndex < moduleCount; colIndex += 1) {
            if (!matrix[rowIndex][colIndex]) continue;
            const x = (colIndex + quietZoneModules) * moduleSize;
            const y = (rowIndex + quietZoneModules) * moduleSize;
            pathData.push(`M${x} ${y}h${moduleSize}v${moduleSize}H${x}z`);
        }
    }

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qrSize} ${qrSize}" width="${qrSize}" height="${qrSize}" shape-rendering="crispEdges">`,
        `<rect width="${qrSize}" height="${qrSize}" fill="${backgroundColor}"/>`,
        `<path d="${pathData.join("")}" fill="${foregroundColor}"/>`,
        "</svg>",
    ].join("");
}

export function buildSeatQrManifest(
    roomId: string,
    layout: LayoutConfig,
    baseUrl = DEFAULT_SEAT_QR_BASE_URL
) {
    const seats = sortSeatsByPosition(buildSeatManifest(roomId, layout));

    return seats.map((seat): SeatQrManifestEntry => ({
        ...seat,
        qrUrl: createSeatQrUrl(baseUrl, seat.tagId),
        fileName: `${sanitizeFileToken(seat.label)}-${seat.seatId}.svg`,
    }));
}

export function buildTeacherQrAsset(roomId: string, baseUrl = DEFAULT_SEAT_QR_BASE_URL): TeacherQrAsset {
    return {
        roomId,
        label: "Professor Dashboard",
        qrUrl: createTeacherQrUrl(baseUrl, roomId),
        fileName: `TEACHER-${sanitizeFileToken(roomId)}.svg`,
    };
}

export function buildSeatQrCatalogHtml({
    roomId,
    entries,
    baseUrl,
    teacher,
}: {
    roomId: string;
    entries: SeatQrManifestEntry[];
    baseUrl: string;
    teacher?: TeacherQrAsset;
}) {
    const seatCards = entries.map((entry) => [
        `<article class="seat-card">`,
        `<div class="seat-card__qr"><img src="./${escapeHtml(entry.fileName)}" alt="QR code for seat ${escapeHtml(entry.label)}" /></div>`,
        `<div class="seat-card__meta">`,
        `<h2>${escapeHtml(entry.label)}</h2>`,
        `<p>${escapeHtml(entry.seatId)}</p>`,
        `<p class="seat-card__tag">${escapeHtml(entry.tagId)}</p>`,
        `</div>`,
        `</article>`,
    ].join("")).join("\n");
    const teacherCard = teacher ? [
        `<article class="seat-card seat-card--teacher">`,
        `<div class="seat-card__qr"><img src="./${escapeHtml(teacher.fileName)}" alt="QR code for ${escapeHtml(teacher.label)}" /></div>`,
        `<div class="seat-card__meta">`,
        `<h2>${escapeHtml(teacher.label)}</h2>`,
        `<p>room: ${escapeHtml(teacher.roomId)}</p>`,
        `<p class="seat-card__tag">mode=professor</p>`,
        `</div>`,
        `</article>`,
    ].join("") : "";
    const cards = [teacherCard, seatCards].filter(Boolean).join("\n");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(roomId)} seat QR codes</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1e3a5f;
      --muted: #6b7280;
      --paper: #f7f4ed;
      --card: #ffffff;
      --line: #d7cfbf;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, serif;
      color: var(--ink);
      background: linear-gradient(180deg, #f9f6ef 0%, #f2ecdf 100%);
    }
    main {
      max-width: 1280px;
      margin: 0 auto;
      padding: 32px 24px 48px;
    }
    header {
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 32px;
      line-height: 1.05;
    }
    header p {
      margin: 0;
      color: var(--muted);
      font-family: Menlo, monospace;
      font-size: 13px;
    }
    .sheet {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 14px;
    }
    .seat-card {
      break-inside: avoid;
      page-break-inside: avoid;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
      box-shadow: 0 10px 20px rgba(30, 58, 95, 0.06);
    }
    .seat-card--teacher {
      border-color: #1e3a5f;
      background: #f7fbff;
    }
    .seat-card__qr {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      padding: 10px;
      margin-bottom: 12px;
    }
    .seat-card__qr img {
      display: block;
      width: 100%;
      height: auto;
    }
    .seat-card__meta h2 {
      margin: 0 0 4px;
      font-size: 22px;
    }
    .seat-card__meta p {
      margin: 0;
      font-family: Menlo, monospace;
      font-size: 12px;
      color: var(--muted);
    }
    .seat-card__tag {
      margin-top: 6px !important;
      word-break: break-word;
    }
    @page {
      size: letter portrait;
      margin: 0.45in;
    }
    @media print {
      body {
        background: white;
      }
      main {
        padding: 0;
      }
      .seat-card {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(roomId)} Seat QR Codes</h1>
      <p>${entries.length} seats · Base URL ${escapeHtml(baseUrl)}</p>
    </header>
    <section class="sheet">
      ${cards}
    </section>
  </main>
</body>
</html>`;
}
