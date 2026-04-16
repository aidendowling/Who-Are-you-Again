export interface LayoutConfig {
    id?: string;
    name: string;
    rows: number;
    seatsPerSection: number;
    sections: 1 | 2 | 3 | 4;
    createdBy?: string;
}

export interface RoomSeat {
    seatId: string;
    label: string;
    rowIndex: number;
    colIndex: number;
    sectionIndex: number;
    isActive: boolean;
    tagId: string;
    legacyLabels: string[];
}

export const DEFAULT_LAYOUT: LayoutConfig = {
    name: "New Layout",
    rows: 12,
    seatsPerSection: 4,
    sections: 3,
};

// Keep seat labels contiguous (A, B, C...) so QR labels match the seating map.
export const AISLE_GAP = 0;
export const ADJACENT_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],  [0, 0],  [0, 1],
    [1, -1],  [1, 0],  [1, 1],
] as const;

export function generateCols(count: number, offset = 0): string[] {
    return Array.from({ length: count }, (_, index) =>
        String.fromCharCode(65 + offset + index)
    );
}

export function totalSeatsForLayout(layout: LayoutConfig): number {
    return layout.rows * layout.seatsPerSection * layout.sections;
}

export function createSeatId(rowIndex: number, colIndex: number) {
    return `r${rowIndex}c${colIndex}`;
}

export function createSeatLabel(rowIndex: number, colIndex: number) {
    return `${rowIndex + 1}${indexToColumn(colIndex)}`;
}

export function indexToColumn(index: number) {
    let value = index;
    let result = "";

    do {
        result = String.fromCharCode(65 + (value % 26)) + result;
        value = Math.floor(value / 26) - 1;
    } while (value >= 0);

    return result;
}

export function normalizeSeatLabel(rawLabel: string) {
    const trimmed = rawLabel.trim().toUpperCase().replace(/\s+/g, "");
    if (!trimmed) return "";

    const rowFirst = trimmed.match(/^(\d+)([A-Z]+)$/);
    if (rowFirst) {
        return `${Number(rowFirst[1])}${rowFirst[2]}`;
    }

    const colFirst = trimmed.match(/^([A-Z]+)(\d+)$/);
    if (colFirst) {
        return `${Number(colFirst[2])}${colFirst[1]}`;
    }

    return trimmed;
}

export function legacySeatLabelsFor(rowIndex: number, colIndex: number) {
    const row = rowIndex + 1;
    const col = indexToColumn(colIndex);
    return [createSeatLabel(rowIndex, colIndex), `${col}${row}`];
}

export function createTagId(roomId: string, seatId: string) {
    return `qr-${roomId}-${seatId}`;
}

export function parseTagId(tagId: string) {
    const match = tagId.trim().match(/^qr-(.+)-(r\d+c\d+)$/i);
    if (!match) {
        return null;
    }

    return {
        roomId: match[1],
        seatId: match[2].toLowerCase(),
    };
}

export function buildSeatManifest(roomId: string, layout: LayoutConfig): RoomSeat[] {
    const seats: RoomSeat[] = [];

    for (let sectionIndex = 0; sectionIndex < layout.sections; sectionIndex += 1) {
        const sectionOffset = sectionIndex * (layout.seatsPerSection + AISLE_GAP);

        for (let rowIndex = 0; rowIndex < layout.rows; rowIndex += 1) {
            for (let seatOffset = 0; seatOffset < layout.seatsPerSection; seatOffset += 1) {
                const colIndex = sectionOffset + seatOffset;
                const seatId = createSeatId(rowIndex, colIndex);
                seats.push({
                    seatId,
                    label: createSeatLabel(rowIndex, colIndex),
                    rowIndex,
                    colIndex,
                    sectionIndex,
                    isActive: true,
                    tagId: createTagId(roomId, seatId),
                    legacyLabels: legacySeatLabelsFor(rowIndex, colIndex),
                });
            }
        }
    }

    return seats;
}

export function resolveSeatByLabel(seats: RoomSeat[], rawLabel: string) {
    const normalized = normalizeSeatLabel(rawLabel);
    return seats.find((seat) =>
        seat.legacyLabels.some((candidate) => normalizeSeatLabel(candidate) === normalized)
    );
}

export function sortSeatsByPosition<T extends Pick<RoomSeat, "rowIndex" | "colIndex">>(seats: T[]) {
    return [...seats].sort((left, right) => {
        if (left.rowIndex !== right.rowIndex) {
            return left.rowIndex - right.rowIndex;
        }

        return left.colIndex - right.colIndex;
    });
}

export function getNearbySeats<
    T extends Pick<RoomSeat, "seatId" | "rowIndex" | "colIndex" | "label"> & { isActive?: boolean }
>(
    viewerSeat: T,
    seats: T[]
) {
    const candidates = new Map<string, T>();
    candidates.set(viewerSeat.seatId, viewerSeat);

    for (const seat of seats) {
        if (seat.isActive === false) continue;
        if (Math.abs(seat.rowIndex - viewerSeat.rowIndex) <= 1 && Math.abs(seat.colIndex - viewerSeat.colIndex) <= 1) {
            candidates.set(seat.seatId, seat);
        }
    }

    return sortSeatsByPosition(Array.from(candidates.values()));
}

export function getAdjacentSeatIdsForViewer(viewerSeat: Pick<RoomSeat, "rowIndex" | "colIndex">) {
    return ADJACENT_OFFSETS.map(([rowOffset, colOffset]) =>
        createSeatId(viewerSeat.rowIndex + rowOffset, viewerSeat.colIndex + colOffset)
    );
}
