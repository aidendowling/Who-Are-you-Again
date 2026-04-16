import {
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    where,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { getOrCreateSeatManifest, syncSeatManifest } from "./seatManifest";
import {
    getAdjacentSeatIdsForViewer,
    getNearbySeats as getNearbySeatCards,
    parseTagId,
} from "./seating";
import { ensureAnonymousUid } from "../utils/auth";

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

interface CheckInRecord {
    uid: string;
    roomId: string;
    seatId: string;
    seat?: string;
    seatLabel?: string;
    name?: string;
    year?: string;
    major?: string;
    interests?: string;
    funFact?: string;
    avatarType?: string;
    avatarUri?: string | null;
    emoji?: string;
    status?: "active" | "ended";
    handRaised?: boolean;
}

interface OccupancyRecord {
    seatId: string;
    uid: string;
    checkedInAt: string;
    preview: {
        firstName: string;
        year: string;
        major: string;
        interests?: string;
        funFact?: string;
        avatarType: string;
        avatarUri: string | null;
        emoji: string;
    };
}

function getCheckInDoc(roomId: string, uid: string) {
    return doc(db, "rooms", roomId, "checkins", uid);
}

function getOccupancyDoc(roomId: string, seatId: string) {
    return doc(db, "rooms", roomId, "occupancy", seatId);
}

function getUserDoc(uid: string) {
    return doc(db, "users", uid);
}

async function requireUid() {
    return auth.currentUser?.uid ?? ensureAnonymousUid();
}

async function resolveSeatTag(tagId: string) {
    const parsed = parseTagId(tagId);
    if (parsed) {
        return parsed;
    }

    const groupSnap = await getDocs(
        query(collectionGroup(db, "seatTags"), where("tagId", "==", tagId))
    );
    const first = groupSnap.docs[0];
    if (!first) {
        throw new Error("Seat tag was not found.");
    }

    const data = first.data() as { roomId?: string; seatId?: string };
    if (!data.roomId || !data.seatId) {
        throw new Error("Seat tag is missing room metadata.");
    }

    return {
        roomId: data.roomId,
        seatId: data.seatId,
    };
}

async function loadOwnProfile(uid: string) {
    const userSnap = await getDoc(getUserDoc(uid));
    return userSnap.exists() ? userSnap.data() ?? {} : {};
}

export async function checkInToSeat(tagId: string, method: "qr" | "nfc" = "qr") {
    const uid = await requireUid();
    const { roomId, seatId } = await resolveSeatTag(tagId);
    const seats = await getOrCreateSeatManifest(roomId);
    const seat = seats.find((candidate) => candidate.seatId === seatId);

    if (!seat) {
        throw new Error("Seat does not exist.");
    }

    if (seat.isActive === false) {
        throw new Error("Seat is inactive.");
    }

    const profile = await loadOwnProfile(uid);
    const name = String(profile.name || "Student").trim() || "Student";
    const firstName = name.split(/\s+/)[0] || "Student";
    const year = String(profile.year || "");
    const major = String(profile.major || "");
    const interests = String(profile.interests || "");
    const funFact = String(profile.funFact || "");
    const avatarType = String(profile.avatarType || "emoji");
    const avatarUri = (profile.avatarUri as string | null) ?? null;
    const emoji = String(profile.emoji || "😊");
    const checkedInAt = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
        const userRef = getUserDoc(uid);
        const userSnap = await transaction.get(userRef);
        const userData = userSnap.exists() ? (userSnap.data() as {
            activeRoomId?: string | null;
            activeSeatId?: string | null;
        }) : {};
        const occupancyRef = getOccupancyDoc(roomId, seatId);
        const occupancySnap = await transaction.get(occupancyRef);

        if (occupancySnap.exists()) {
            const occupancy = occupancySnap.data() as OccupancyRecord;
            if (occupancy.uid !== uid) {
                throw new Error("That seat is already occupied.");
            }
        }

        const previousRoomId = userData.activeRoomId || undefined;
        const previousSeatId = userData.activeSeatId || undefined;
        if (
            previousRoomId &&
            previousSeatId &&
            !(previousRoomId === roomId && previousSeatId === seatId)
        ) {
            const previousOccupancyRef = getOccupancyDoc(previousRoomId, previousSeatId);
            const previousOccupancySnap = await transaction.get(previousOccupancyRef);
            if (previousOccupancySnap.exists()) {
                const occupancy = previousOccupancySnap.data() as OccupancyRecord;
                if (occupancy.uid === uid) {
                    transaction.delete(previousOccupancyRef);
                }
            }

            transaction.delete(getCheckInDoc(previousRoomId, uid));
        }

        transaction.set(
            getCheckInDoc(roomId, uid),
            {
                uid,
                roomId,
                seatId,
                seat: seat.label,
                seatLabel: seat.label,
                name,
                year,
                major,
                interests,
                funFact,
                avatarType,
                avatarUri,
                emoji,
                handRaised: false,
                checkedInAt,
                status: "active",
                userType: "student",
                method,
            },
            { merge: true }
        );

        transaction.set(
            occupancyRef,
            {
                seatId,
                uid,
                checkedInAt,
                preview: {
                    firstName,
                    year,
                    major,
                    interests,
                    funFact,
                    avatarType,
                    avatarUri,
                    emoji,
                },
            },
            { merge: true }
        );

        transaction.set(
            userRef,
            {
                activeRoomId: roomId,
                activeSeatId: seatId,
                updatedAt: checkedInAt,
            },
            { merge: true }
        );
    });

    return {
        roomId,
        seatId,
        seatLabel: seat.label,
    };
}

export async function leaveSeat(roomId: string) {
    const uid = await requireUid();
    const checkInRef = getCheckInDoc(roomId, uid);
    const checkInSnap = await getDoc(checkInRef);

    if (!checkInSnap.exists()) {
        return { success: true };
    }

    const checkIn = checkInSnap.data() as CheckInRecord;

    await runTransaction(db, async (transaction) => {
        const userRef = getUserDoc(uid);
        const userSnap = await transaction.get(userRef);
        const userData = userSnap.exists() ? (userSnap.data() as {
            activeRoomId?: string | null;
            activeSeatId?: string | null;
        }) : {};

        if (checkIn.seatId) {
            const occupancyRef = getOccupancyDoc(roomId, checkIn.seatId);
            const occupancySnap = await transaction.get(occupancyRef);
            if (occupancySnap.exists()) {
                const occupancy = occupancySnap.data() as OccupancyRecord;
                if (occupancy.uid === uid) {
                    transaction.delete(occupancyRef);
                }
            }
        }

        transaction.delete(checkInRef);

        if (userData.activeRoomId === roomId) {
            transaction.set(
                userRef,
                {
                    activeRoomId: null,
                    activeSeatId: null,
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );
        }
    });

    return { success: true };
}

export async function syncRoomManifest(roomId: string) {
    await syncSeatManifest(roomId);
    return { success: true };
}

export async function fetchNearbySeats(roomId: string) {
    const uid = await requireUid();
    const checkInSnap = await getDoc(getCheckInDoc(roomId, uid));

    if (!checkInSnap.exists()) {
        throw new Error("You are not checked into this room.");
    }

    const checkIn = checkInSnap.data() as CheckInRecord;
    const seats = await getOrCreateSeatManifest(roomId);
    const seatMap = new Map(seats.map((seat) => [seat.seatId, seat]));
    const viewerSeat = seatMap.get(checkIn.seatId);

    if (!viewerSeat) {
        throw new Error("Viewer seat could not be resolved.");
    }

    const nearbySeats = getNearbySeatCards(viewerSeat, seats);
    const occupancySnaps = await getDocs(collection(db, "rooms", roomId, "occupancy"));
    const occupancyMap = new Map<string, OccupancyRecord>(
        occupancySnaps.docs.map((snap) => [snap.id, snap.data() as OccupancyRecord])
    );

    return {
        roomId,
        viewerSeat: {
            seatId: viewerSeat.seatId,
            label: viewerSeat.label,
            rowIndex: viewerSeat.rowIndex,
            colIndex: viewerSeat.colIndex,
        },
        minRow: Math.min(...nearbySeats.map((seat) => seat.rowIndex)),
        maxRow: Math.max(...nearbySeats.map((seat) => seat.rowIndex)),
        minCol: Math.min(...nearbySeats.map((seat) => seat.colIndex)),
        maxCol: Math.max(...nearbySeats.map((seat) => seat.colIndex)),
        seats: nearbySeats.map((seat) => {
            if (seat.seatId === viewerSeat.seatId) {
                return {
                    seatId: seat.seatId,
                    label: seat.label,
                    rowIndex: seat.rowIndex,
                    colIndex: seat.colIndex,
                    status: "self" as const,
                };
            }

            const occupancy = occupancyMap.get(seat.seatId);
            if (!occupancy) {
                return {
                    seatId: seat.seatId,
                    label: seat.label,
                    rowIndex: seat.rowIndex,
                    colIndex: seat.colIndex,
                    status: "empty" as const,
                };
            }

            return {
                seatId: seat.seatId,
                label: seat.label,
                rowIndex: seat.rowIndex,
                colIndex: seat.colIndex,
                status: "occupied" as const,
                uid: occupancy.uid,
                preview: occupancy.preview,
            };
        }),
    };
}

export async function fetchNearbyStudentProfile(roomId: string, targetUid: string) {
    const uid = await requireUid();
    const checkInSnap = await getDoc(getCheckInDoc(roomId, uid));

    if (!checkInSnap.exists()) {
        throw new Error("You are not checked into this room.");
    }

    const checkIn = checkInSnap.data() as CheckInRecord;
    const seats = await getOrCreateSeatManifest(roomId);
    const seatMap = new Map(seats.map((seat) => [seat.seatId, seat]));
    const viewerSeat = seatMap.get(checkIn.seatId);

    if (!viewerSeat) {
        throw new Error("Viewer seat could not be resolved.");
    }

    const nearbySeatIds = new Set(getAdjacentSeatIdsForViewer(viewerSeat));
    const occupancySnaps = await getDocs(collection(db, "rooms", roomId, "occupancy"));
    const nearbyOccupant = occupancySnaps.docs
        .map((snap) => snap.data() as OccupancyRecord)
        .find((occupancy) => nearbySeatIds.has(occupancy.seatId) && occupancy.uid === targetUid);

    if (!nearbyOccupant) {
        throw new Error("Target student is not currently adjacent.");
    }

    return {
        uid: targetUid,
        firstName: nearbyOccupant.preview.firstName || "Student",
        year: nearbyOccupant.preview.year || "",
        major: nearbyOccupant.preview.major || "",
        interests: nearbyOccupant.preview.interests || "",
        funFact: nearbyOccupant.preview.funFact || "",
        avatarType: nearbyOccupant.preview.avatarType || "emoji",
        avatarUri: nearbyOccupant.preview.avatarUri ?? null,
        emoji: nearbyOccupant.preview.emoji || "😊",
    };
}
