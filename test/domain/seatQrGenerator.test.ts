import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LayoutConfig } from "../../shared/classroom";
import {
    buildSeatQrManifest,
    createQrMatrix,
    createSeatQrUrl,
    renderQrSvg,
} from "../../shared/seatQr";
import { writeSeatQrPackage } from "../../scripts/seatQrExport";

const COMPACT_LAYOUT: LayoutConfig = {
    name: "Compact",
    rows: 2,
    seatsPerSection: 2,
    sections: 2,
};

test("buildSeatQrManifest derives row-major seat entries with stable QR URLs", () => {
    const manifest = buildSeatQrManifest(
        "qr-room",
        COMPACT_LAYOUT,
        "https://app.whoru.edu/checkin"
    );

    assert.equal(manifest.length, 8);
    assert.deepEqual(
        manifest.map((entry) => entry.label),
        ["1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D"]
    );
    assert.equal(manifest[0].qrUrl, "https://app.whoru.edu/checkin?t=qr-qr-room-r0c0");
    assert.equal(manifest[0].fileName, "1A-r0c0.svg");
});

test("renderQrSvg emits a square QR with quiet zone and dark modules", () => {
    const payload = createSeatQrUrl("https://app.whoru.edu/checkin", "qr-room-r0c0");
    const matrix = createQrMatrix(payload);
    const darkModuleCount = matrix.flat().filter(Boolean).length;
    const svg = renderQrSvg(payload, { moduleSize: 4, quietZoneModules: 4 });
    const expectedSize = (matrix.length + 8) * 4;

    assert.ok(matrix.length > 20);
    assert.ok(darkModuleCount > 100);
    assert.match(svg, /<svg[^>]+shape-rendering="crispEdges"/);
    assert.match(svg, new RegExp(`viewBox="0 0 ${expectedSize} ${expectedSize}"`));
    assert.match(svg, /<path d="M/);
});

test("writeSeatQrPackage writes svg assets, printable html, and csv manifest", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "seat-qrs-"));

    try {
        const result = await writeSeatQrPackage({
            roomId: "export-room",
            layout: COMPACT_LAYOUT,
            outputDir,
            baseUrl: "https://app.whoru.edu/checkin",
        });

        const files = await readdir(outputDir);
        const svgFiles = files.filter((file) => file.endsWith(".svg"));
        const html = await readFile(result.htmlPath, "utf8");
        const csv = await readFile(result.manifestPath, "utf8");

        assert.equal(result.entries.length, 8);
        assert.equal(svgFiles.length, 9);
        assert.ok(files.includes("index.html"));
        assert.ok(files.includes("manifest.csv"));
        assert.ok(files.includes("1A-r0c0.svg"));
        assert.ok(files.includes("TEACHER-export-room.svg"));
        assert.match(html, /export-room Seat QR Codes/);
        assert.match(html, /Professor Dashboard/);
        assert.match(html, /1A/);
        assert.match(csv, /seatId,label,rowIndex,colIndex,sectionIndex,tagId,qrUrl,fileName/);
        assert.match(csv, /r0c0,1A,0,0,0,qr-export-room-r0c0,https:\/\/app\.whoru\.edu\/checkin\?t=qr-export-room-r0c0,1A-r0c0\.svg/);
    } finally {
        await rm(outputDir, { recursive: true, force: true });
    }
});
