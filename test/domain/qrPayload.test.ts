import assert from "node:assert/strict";
import test from "node:test";
import { parseSeatScanPayload } from "../../src/lib/qrPayload";
import { createSeatQrUrl } from "../../shared/seatQr";

test("parseSeatScanPayload supports the tag URI format already used by the app", () => {
    assert.deepEqual(
        parseSeatScanPayload("synapse://seat-tag/qr-cs4605-default-r0c0"),
        {
            kind: "tag",
            tagId: "qr-cs4605-default-r0c0",
        }
    );
});

test("parseSeatScanPayload supports static QR URLs with a tag query parameter", () => {
    assert.deepEqual(
        parseSeatScanPayload("https://app.whoru.edu/checkin?t=qr-cs4605-default-r0c0"),
        {
            kind: "tag",
            tagId: "qr-cs4605-default-r0c0",
        }
    );
});

test("parseSeatScanPayload supports professor room QR payloads", () => {
    assert.deepEqual(
        parseSeatScanPayload("https://app.whoru.edu/checkin?mode=professor&roomId=cs4605-default"),
        {
            kind: "professor-room",
            roomId: "cs4605-default",
        }
    );
});

test("parseSeatScanPayload round-trips URLs emitted by the seat QR generator", () => {
    const payload = createSeatQrUrl("https://app.whoru.edu/checkin", "qr-room-a-r0c0");
    assert.deepEqual(parseSeatScanPayload(payload), {
        kind: "tag",
        tagId: "qr-room-a-r0c0",
    });
});

test("parseSeatScanPayload preserves the legacy room and seat payload format", () => {
    assert.deepEqual(
        parseSeatScanPayload("wh0ru://room/test-room/seat/1A"),
        {
            kind: "legacy-seat",
            roomId: "test-room",
            seatLabel: "1A",
        }
    );
});

test("parseSeatScanPayload rejects unsupported payloads", () => {
    assert.equal(parseSeatScanPayload("not-a-seat-scan"), null);
});

test("parseSeatScanPayload handles malformed URI encoding without throwing", () => {
    assert.equal(parseSeatScanPayload("synapse://seat-tag/%E0%A4%A"), null);
});
