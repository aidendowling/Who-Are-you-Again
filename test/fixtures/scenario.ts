import {
    DEFAULT_LAYOUT,
    LayoutConfig,
    RoomSeat,
    buildSeatManifest,
    resolveSeatByLabel,
} from "../../shared/classroom";

export interface UserFixture {
    label: string;
    userType: "student" | "professor";
    name?: string;
    emoji?: string;
    avatarType?: string;
    avatarUri?: string | null;
    year?: string;
    major?: string;
    interests?: string;
    funFact?: string;
}

export interface RoomFixture {
    roomId: string;
    layout: LayoutConfig;
    seats: RoomSeat[];
}

export interface CheckInFixture {
    roomId: string;
    seatId: string;
    seatLabel: string;
    tagId: string;
}

export interface NearbyScenario {
    room: RoomFixture;
    viewer: CheckInFixture;
    neighbors: CheckInFixture[];
    emptySeats: RoomSeat[];
}

export function createRoomFixture(overrides: Partial<Omit<RoomFixture, "seats">> = {}): RoomFixture {
    const roomId = overrides.roomId ?? "test-room";
    const layout = overrides.layout ?? DEFAULT_LAYOUT;

    return {
        roomId,
        layout,
        seats: buildSeatManifest(roomId, layout),
    };
}

export function createCheckInFixture(room: RoomFixture, rawSeatLabel: string): CheckInFixture {
    const seat = resolveSeatByLabel(room.seats, rawSeatLabel);
    if (!seat) {
        throw new Error(`Seat ${rawSeatLabel} does not exist in room ${room.roomId}.`);
    }

    return {
        roomId: room.roomId,
        seatId: seat.seatId,
        seatLabel: seat.label,
        tagId: seat.tagId,
    };
}

export function createNearbyScenario(
    room: RoomFixture,
    viewerSeatLabel: string,
    neighborSeatLabels: string[]
): NearbyScenario {
    const viewer = createCheckInFixture(room, viewerSeatLabel);
    const neighbors = neighborSeatLabels.map((label) => createCheckInFixture(room, label));
    const occupiedSeatIds = new Set([viewer.seatId, ...neighbors.map((neighbor) => neighbor.seatId)]);
    const emptySeats = room.seats.filter((seat) => !occupiedSeatIds.has(seat.seatId));

    return {
        room,
        viewer,
        neighbors,
        emptySeats,
    };
}
