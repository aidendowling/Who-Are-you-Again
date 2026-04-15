export type ParsedSeatScanPayload =
    | {
        kind: "tag";
        tagId: string;
    }
    | {
        kind: "professor-room";
        roomId: string;
    }
    | {
        kind: "legacy-seat";
        roomId: string;
        seatLabel: string;
    };

const TAG_SCHEME_PATTERN = /(?:synapse|wh0ru):\/\/(?:seat-tag|tag)\/([^/?#]+)/i;
const LEGACY_SEAT_PATTERN = /^wh0ru:\/\/room\/([^/]+)\/seat\/(.+)$/i;

function decodeSegment(value: string) {
    try {
        return decodeURIComponent(value).trim();
    } catch {
        return "";
    }
}

export function parseSeatScanPayload(rawData: string): ParsedSeatScanPayload | null {
    const data = rawData.trim();
    if (!data) {
        return null;
    }

    const tagMatch = data.match(TAG_SCHEME_PATTERN);
    if (tagMatch) {
        const tagId = decodeSegment(tagMatch[1]);
        return tagId ? { kind: "tag", tagId } : null;
    }

    const legacyMatch = data.match(LEGACY_SEAT_PATTERN);
    if (legacyMatch) {
        const roomId = decodeSegment(legacyMatch[1]);
        const seatLabel = decodeSegment(legacyMatch[2]);
        return roomId && seatLabel
            ? { kind: "legacy-seat", roomId, seatLabel }
            : null;
    }

    try {
        const url = new URL(data);
        const mode = decodeSegment(url.searchParams.get("mode") || "");
        const role = decodeSegment(url.searchParams.get("role") || "");
        const professorHint = mode.toLowerCase() === "professor" || role.toLowerCase() === "professor";
        if (professorHint) {
            const roomId = decodeSegment(url.searchParams.get("roomId") || "");
            return roomId ? { kind: "professor-room", roomId } : null;
        }

        const tagId = decodeSegment(url.searchParams.get("t") || "");
        return tagId ? { kind: "tag", tagId } : null;
    } catch {
        return null;
    }
}
