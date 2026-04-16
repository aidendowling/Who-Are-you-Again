export {
    ADJACENT_OFFSETS,
    AISLE_GAP,
    DEFAULT_LAYOUT,
    buildSeatManifest,
    createSeatId,
    createSeatLabel,
    createTagId,
    generateCols,
    getAdjacentSeatIdsForViewer,
    getNearbySeats,
    indexToColumn,
    legacySeatLabelsFor,
    normalizeSeatLabel,
    parseTagId,
    resolveSeatByLabel,
    sortSeatsByPosition,
    totalSeatsForLayout,
} from "../../shared/classroom";

export type {
    LayoutConfig,
    RoomSeat,
} from "../../shared/classroom";
