import { DEFAULT_LAYOUT, buildSeatManifest, resolveSeatByLabel } from "./seating";
import { checkInToSeat, syncRoomManifest } from "./proximityApi";

export const TEST_ROOM_ID = "test-room";
export const TEST_ROOM_SEAT_LABEL = "1A";

export type TestSupportUserType = "student" | "professor";

export interface TestRoomSuccess {
    ok: true;
    roomId: string;
    route: "classroom" | "professor";
    seatId?: string;
    seatLabel?: string;
}

export interface TestRoomFailure {
    ok: false;
    code:
        | "test-support-disabled"
        | "manifest-sync-failed"
        | "seat-resolution-failed"
        | "seat-check-in-failed";
    message: string;
    cause?: unknown;
}

export type TestRoomResult = TestRoomSuccess | TestRoomFailure;

export function isTestSupportEnabled() {
    return __DEV__ || process.env.EXPO_PUBLIC_ENABLE_TEST_SUPPORT === "1";
}

export async function bootstrapTestRoom(userType: TestSupportUserType): Promise<TestRoomResult> {
    if (!isTestSupportEnabled()) {
        return {
            ok: false,
            code: "test-support-disabled",
            message: "Test room access is disabled outside development and explicit test mode.",
        };
    }

    try {
        await syncRoomManifest(TEST_ROOM_ID);
    } catch (cause) {
        return {
            ok: false,
            code: "manifest-sync-failed",
            message: "Could not seed the test room manifest.",
            cause,
        };
    }

    if (userType === "professor") {
        return {
            ok: true,
            roomId: TEST_ROOM_ID,
            route: "professor",
        };
    }

    const seat = resolveSeatByLabel(
        buildSeatManifest(TEST_ROOM_ID, DEFAULT_LAYOUT),
        TEST_ROOM_SEAT_LABEL
    );
    if (!seat) {
        return {
            ok: false,
            code: "seat-resolution-failed",
            message: `The seeded test seat ${TEST_ROOM_SEAT_LABEL} could not be resolved.`,
        };
    }

    try {
        const checkIn = await checkInToSeat(seat.tagId, "qr");
        return {
            ok: true,
            roomId: checkIn.roomId,
            route: "classroom",
            seatId: checkIn.seatId,
            seatLabel: checkIn.seatLabel,
        };
    } catch (cause) {
        return {
            ok: false,
            code: "seat-check-in-failed",
            message: `Could not check into test seat ${TEST_ROOM_SEAT_LABEL}.`,
            cause,
        };
    }
}
