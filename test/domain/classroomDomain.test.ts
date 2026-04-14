import assert from "node:assert/strict";
import test from "node:test";
import {
    buildSeatManifest,
    getNearbySeats,
    normalizeSeatLabel,
} from "../../shared/classroom";
import { createRoomFixture } from "../fixtures/scenario";

test("buildSeatManifest generates seat ids, labels, tags, and section offsets deterministically", () => {
    const room = createRoomFixture({
        roomId: "calc-room",
        layout: {
            name: "Compact",
            rows: 2,
            seatsPerSection: 2,
            sections: 2,
        },
    });

    const seats = buildSeatManifest(room.roomId, room.layout);

    assert.equal(seats.length, 8);
    assert.deepEqual(
        seats.map((seat) => ({
            seatId: seat.seatId,
            label: seat.label,
            colIndex: seat.colIndex,
            tagId: seat.tagId,
        })),
        [
            { seatId: "r0c0", label: "1A", colIndex: 0, tagId: "qr-calc-room-r0c0" },
            { seatId: "r0c1", label: "1B", colIndex: 1, tagId: "qr-calc-room-r0c1" },
            { seatId: "r1c0", label: "2A", colIndex: 0, tagId: "qr-calc-room-r1c0" },
            { seatId: "r1c1", label: "2B", colIndex: 1, tagId: "qr-calc-room-r1c1" },
            { seatId: "r0c3", label: "1D", colIndex: 3, tagId: "qr-calc-room-r0c3" },
            { seatId: "r0c4", label: "1E", colIndex: 4, tagId: "qr-calc-room-r0c4" },
            { seatId: "r1c3", label: "2D", colIndex: 3, tagId: "qr-calc-room-r1c3" },
            { seatId: "r1c4", label: "2E", colIndex: 4, tagId: "qr-calc-room-r1c4" },
        ]
    );
});

test("normalizeSeatLabel accepts canonical and legacy seat formats", () => {
    assert.equal(normalizeSeatLabel("1a"), "1A");
    assert.equal(normalizeSeatLabel(" A1 "), "1A");
    assert.equal(normalizeSeatLabel(" 12 c "), "12C");
    assert.equal(normalizeSeatLabel("C12"), "12C");
});

test("getNearbySeats returns only the viewer and physically adjacent seats at room edges", () => {
    const room = createRoomFixture({
        roomId: "edge-room",
        layout: {
            name: "Edge Case",
            rows: 3,
            seatsPerSection: 3,
            sections: 1,
        },
    });

    const viewer = room.seats.find((seat) => seat.label === "1A");
    assert.ok(viewer);

    const nearby = getNearbySeats(viewer, room.seats);

    assert.deepEqual(
        nearby.map((seat) => seat.label),
        ["1A", "1B", "2A", "2B"]
    );
});
