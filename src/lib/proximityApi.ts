import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";

export interface NearbySeatCard {
    seatId: string;
    label: string;
    rowIndex: number;
    colIndex: number;
    status: "self" | "occupied" | "empty";
    uid?: string;
    preview?: {
        firstName: string;
        year: string;
        major: string;
        avatarType: string;
        avatarUri: string | null;
        emoji: string;
    };
}

export interface NearbySeatsResponse {
    roomId: string;
    viewerSeat: {
        seatId: string;
        label: string;
        rowIndex: number;
        colIndex: number;
    };
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
    seats: NearbySeatCard[];
}

export interface NearbyStudentProfile {
    uid: string;
    firstName: string;
    year: string;
    major: string;
    interests: string;
    funFact: string;
    avatarType: string;
    avatarUri: string | null;
    emoji: string;
}

export async function checkInToSeat(tagId: string, method: "qr" | "nfc" = "qr") {
    const checkIn = httpsCallable<{ tagId: string; method: "qr" | "nfc" }, {
        roomId: string;
        seatId: string;
        seatLabel: string;
    }>(functions, "checkInToSeat");

    const result = await checkIn({ tagId, method });
    return result.data;
}

export async function leaveSeat(roomId: string) {
    const leave = httpsCallable<{ roomId: string }, { success: boolean }>(functions, "leaveSeat");
    const result = await leave({ roomId });
    return result.data;
}

export async function syncRoomManifest(roomId: string) {
    const syncManifest = httpsCallable<{ roomId: string }, { success: boolean }>(
        functions,
        "syncRoomManifest"
    );

    const result = await syncManifest({ roomId });
    return result.data;
}

export async function endRoomSession(roomId: string) {
    const endSession = httpsCallable<{ roomId: string }, { success: boolean }>(
        functions,
        "endRoomSession"
    );
    const result = await endSession({ roomId });
    return result.data;
}

export async function fetchNearbySeats(roomId: string) {
    const getNearby = httpsCallable<{ roomId: string }, NearbySeatsResponse>(
        functions,
        "getNearbySeats"
    );

    const result = await getNearby({ roomId });
    return result.data;
}

export async function fetchNearbyStudentProfile(roomId: string, targetUid: string) {
    const getProfile = httpsCallable<{ roomId: string; targetUid: string }, NearbyStudentProfile>(
        functions,
        "getNearbyStudentProfile"
    );

    const result = await getProfile({ roomId, targetUid });
    return result.data;
}
