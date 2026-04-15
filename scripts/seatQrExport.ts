import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LayoutConfig } from "../shared/classroom";
import {
    buildTeacherQrAsset,
    buildSeatQrCatalogHtml,
    buildSeatQrManifest,
    DEFAULT_SEAT_QR_BASE_URL,
    renderQrSvg,
    SeatQrManifestEntry,
    SeatQrSvgOptions,
} from "../shared/seatQr";

export interface WriteSeatQrPackageOptions {
    roomId: string;
    layout: LayoutConfig;
    outputDir: string;
    baseUrl?: string;
    svgOptions?: SeatQrSvgOptions;
}

export interface WriteSeatQrPackageResult {
    outputDir: string;
    htmlPath: string;
    manifestPath: string;
    teacherQrPath: string;
    entries: SeatQrManifestEntry[];
}

function escapeCsvField(value: string | number | boolean) {
    const encoded = String(value);
    return /[",\n]/.test(encoded)
        ? `"${encoded.replace(/"/g, "\"\"")}"`
        : encoded;
}

function buildManifestCsv(entries: SeatQrManifestEntry[]) {
    const header = [
        "seatId",
        "label",
        "rowIndex",
        "colIndex",
        "sectionIndex",
        "tagId",
        "qrUrl",
        "fileName",
    ];

    const rows = entries.map((entry) => [
        entry.seatId,
        entry.label,
        entry.rowIndex,
        entry.colIndex,
        entry.sectionIndex,
        entry.tagId,
        entry.qrUrl,
        entry.fileName,
    ].map(escapeCsvField).join(","));

    return [header.join(","), ...rows].join("\n");
}

export async function writeSeatQrPackage({
    roomId,
    layout,
    outputDir,
    baseUrl = DEFAULT_SEAT_QR_BASE_URL,
    svgOptions,
}: WriteSeatQrPackageOptions): Promise<WriteSeatQrPackageResult> {
    const entries = buildSeatQrManifest(roomId, layout, baseUrl);
    const teacher = buildTeacherQrAsset(roomId, baseUrl);
    const resolvedOutputDir = path.resolve(outputDir);
    const htmlPath = path.join(resolvedOutputDir, "index.html");
    const manifestPath = path.join(resolvedOutputDir, "manifest.csv");
    const teacherQrPath = path.join(resolvedOutputDir, teacher.fileName);

    await mkdir(resolvedOutputDir, { recursive: true });

    await Promise.all(entries.map((entry) =>
        writeFile(
            path.join(resolvedOutputDir, entry.fileName),
            renderQrSvg(entry.qrUrl, svgOptions),
            "utf8"
        )
    ));
    await writeFile(
        teacherQrPath,
        renderQrSvg(teacher.qrUrl, svgOptions),
        "utf8"
    );

    await writeFile(
        manifestPath,
        buildManifestCsv(entries),
        "utf8"
    );

    await writeFile(
        htmlPath,
        buildSeatQrCatalogHtml({ roomId, entries, baseUrl, teacher }),
        "utf8"
    );

    return {
        outputDir: resolvedOutputDir,
        htmlPath,
        manifestPath,
        teacherQrPath,
        entries,
    };
}
