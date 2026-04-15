import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
    buildSeatManifest,
    DEFAULT_LAYOUT,
    getAdjacentSeatIdsForViewer,
    getNearbySeats as getNearbySeatsForViewer,
    LayoutConfig,
    RoomSeat,
} from "../../shared/classroom";

admin.initializeApp();

const db = getFirestore();

interface SeatTagRecord {
    roomId: string;
    seatId: string;
    isActive?: boolean;
}

interface RoomSeatRecord extends Omit<RoomSeat, "isActive" | "tagId"> {
    isActive?: boolean;
    tagId?: string;
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
        avatarType: string;
        avatarUri: string | null;
        emoji: string;
    };
}

function requireAuth(auth?: { uid?: string }) {
    if (!auth?.uid) {
        throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    return auth.uid;
}

function getSeatDoc(roomId: string, seatId: string) {
    return db.doc(`rooms/${roomId}/seats/${seatId}`);
}

function getCheckInDoc(roomId: string, uid: string) {
    return db.doc(`rooms/${roomId}/checkins/${uid}`);
}

function getOccupancyDoc(roomId: string, seatId: string) {
    return db.doc(`rooms/${roomId}/occupancy/${seatId}`);
}

async function loadSeatTag(tagId: string) {
    const tagSnap = await db
        .collectionGroup("seatTags")
        .where("tagId", "==", tagId)
        .limit(1)
        .get();

    if (tagSnap.empty) {
        throw new HttpsError("not-found", "Seat tag was not found.");
    }

    return tagSnap.docs[0].data() as SeatTagRecord;
}

function tryExtractRoomIdFromTag(tagId: string) {
    const marker = "-r";
    const seatBoundary = tagId.lastIndexOf(marker);
    if (!tagId.startsWith("qr-") || seatBoundary <= 3) {
        return null;
    }

    const roomId = tagId.slice(3, seatBoundary);
    const seatId = tagId.slice(seatBoundary + 1);
    if (!roomId || !/^r\d+c\d+$/.test(seatId)) {
        return null;
    }

    return roomId;
}

async function loadUserProfile(uid: string) {
    const userSnap = await db.doc(`users/${uid}`).get();
    return userSnap.exists ? userSnap.data() ?? {} : {};
}

async function loadActiveCheckIns(uid: string) {
    const snaps = await db
        .collectionGroup("checkins")
        .where("uid", "==", uid)
        .get();

    return snaps.docs.filter((snap) => {
        const data = snap.data() as CheckInRecord;
        return (data.status ?? "active") === "active";
    });
}

async function loadRoomSeats(roomId: string) {
    const seatSnaps = await db.collection(`rooms/${roomId}/seats`).get();
    return seatSnaps.docs.map((seatDoc) => seatDoc.data() as RoomSeatRecord);
}

async function syncRoomSeatManifest(roomId: string) {
    const roomRef = db.doc(`rooms/${roomId}`);
    const roomSnap = await roomRef.get();
    const roomData = roomSnap.exists ? roomSnap.data() ?? {} : {};
    const layout = roomData.layout as LayoutConfig | undefined;
    const resolvedLayout = layout?.rows && layout?.seatsPerSection && layout?.sections
        ? layout
        : DEFAULT_LAYOUT;
    const seats = buildSeatManifest(roomId, resolvedLayout);
    const seatSnaps = await db.collection(`rooms/${roomId}/seats`).get();
    const tagSnaps = await db.collection(`rooms/${roomId}/seatTags`).get();
    const nextSeatIds = new Set(seats.map((seat) => seat.seatId));
    const nextTagIds = new Set(seats.map((seat) => seat.tagId));
    const batch = db.batch();

    batch.set(roomRef, {
        layout: resolvedLayout,
        layoutName: resolvedLayout.name || DEFAULT_LAYOUT.name,
        layoutVersion: 2,
        frontOrientation: "row-ascending-from-podium",
        seatCount: seats.length,
        updatedAt: new Date().toISOString(),
    }, { merge: true });

    seats.forEach((seat) => {
        batch.set(getSeatDoc(roomId, seat.seatId), {
            seatId: seat.seatId,
            label: seat.label,
            rowIndex: seat.rowIndex,
            colIndex: seat.colIndex,
            sectionIndex: seat.sectionIndex,
            isActive: true,
            tagId: seat.tagId,
            legacyLabels: seat.legacyLabels,
            roomId,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        batch.set(db.doc(`rooms/${roomId}/seatTags/${seat.tagId}`), {
            tagId: seat.tagId,
            roomId,
            seatId: seat.seatId,
            method: "qr",
            isActive: true,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    });

    seatSnaps.docs.forEach((seatSnap) => {
        if (!nextSeatIds.has(seatSnap.id)) {
            batch.delete(seatSnap.ref);
        }
    });

    tagSnaps.docs.forEach((tagSnap) => {
        if (!nextTagIds.has(tagSnap.id)) {
            batch.delete(tagSnap.ref);
        }
    });

    await batch.commit();
}

async function loadRoomOccupancy(roomId: string) {
    const occupancySnaps = await db.collection(`rooms/${roomId}/occupancy`).get();
    const occupancyMap = new Map<string, OccupancyRecord>();

    occupancySnaps.docs.forEach((occupancyDoc) => {
        occupancyMap.set(occupancyDoc.id, occupancyDoc.data() as OccupancyRecord);
    });

    return occupancyMap;
}

function buildSeatMap(seats: RoomSeatRecord[]) {
    return new Map(seats.map((seat) => [seat.seatId, seat]));
}

export const checkInToSeat = onCall({ cors: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const tagId = String(request.data?.tagId || "").trim();

    if (!tagId) {
        throw new HttpsError("invalid-argument", "tagId is required.");
    }

    let seatTag: SeatTagRecord;
    try {
        seatTag = await loadSeatTag(tagId);
    } catch (error) {
        if (!(error instanceof HttpsError) || error.code !== "not-found") {
            throw error;
        }

        const fallbackRoomId = tryExtractRoomIdFromTag(tagId);
        if (!fallbackRoomId) {
            throw error;
        }

        await syncRoomSeatManifest(fallbackRoomId);
        seatTag = await loadSeatTag(tagId);
    }

    if (!seatTag.isActive && seatTag.isActive !== undefined) {
        throw new HttpsError("failed-precondition", "Seat tag is inactive.");
    }

    const seatRef = getSeatDoc(seatTag.roomId, seatTag.seatId);
    const seatSnap = await seatRef.get();
    if (!seatSnap.exists) {
        throw new HttpsError("not-found", "Seat does not exist.");
    }

    const seat = seatSnap.data() as RoomSeatRecord;
    if (!seat.isActive && seat.isActive !== undefined) {
        throw new HttpsError("failed-precondition", "Seat is inactive.");
    }

    const profile = await loadUserProfile(uid);
    const name = String(profile.name || "Student").trim() || "Student";
    const firstName = name.split(/\s+/)[0] || "Student";
    const year = String(profile.year || "");
    const major = String(profile.major || "");
    const avatarType = String(profile.avatarType || "emoji");
    const avatarUri = (profile.avatarUri as string | null) ?? null;
    const emoji = String(profile.emoji || "😊");
    const checkedInAt = new Date().toISOString();
    const activeCheckIns = await loadActiveCheckIns(uid);

    await db.runTransaction(async (transaction) => {
        const occupancyRef = getOccupancyDoc(seatTag.roomId, seatTag.seatId);
        const occupancySnap = await transaction.get(occupancyRef);

        if (occupancySnap.exists) {
            const occupancy = occupancySnap.data() as OccupancyRecord;
            if (occupancy.uid !== uid) {
                throw new HttpsError("already-exists", "That seat is already occupied.");
            }
        }

        for (const checkInSnap of activeCheckIns) {
            const active = checkInSnap.data() as CheckInRecord;
            if (active.roomId === seatTag.roomId && active.seatId === seatTag.seatId) {
                continue;
            }

            transaction.delete(getOccupancyDoc(active.roomId, active.seatId));
            transaction.delete(checkInSnap.ref);
        }

        // Mirror only the room-scoped display fields professor views need so the UI
        // can render names and avatars without fan-out reads back into /users.
        transaction.set(
            getCheckInDoc(seatTag.roomId, uid),
            {
                uid,
                roomId: seatTag.roomId,
                seatId: seatTag.seatId,
                seat: seat.label,
                seatLabel: seat.label,
                name,
                year,
                major,
                avatarType,
                avatarUri,
                emoji,
                handRaised: false,
                checkedInAt,
                status: "active",
                userType: "student",
                method: request.data?.method === "nfc" ? "nfc" : "qr",
            },
            { merge: true }
        );

        transaction.set(occupancyRef, {
            seatId: seatTag.seatId,
            uid,
            checkedInAt,
            preview: {
                firstName,
                year,
                major,
                avatarType,
                avatarUri,
                emoji,
            },
        });
    });

    return {
        roomId: seatTag.roomId,
        seatId: seatTag.seatId,
        seatLabel: seat.label,
    };
});

export const syncRoomManifest = onCall({ cors: true }, async (request) => {
    requireAuth(request.auth);
    const roomId = String(request.data?.roomId || "").trim();

    if (!roomId) {
        throw new HttpsError("invalid-argument", "roomId is required.");
    }

    await syncRoomSeatManifest(roomId);
    return { success: true };
});

export const leaveSeat = onCall({ cors: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const roomId = String(request.data?.roomId || "").trim();

    if (!roomId) {
        throw new HttpsError("invalid-argument", "roomId is required.");
    }

    const checkInRef = getCheckInDoc(roomId, uid);
    const checkInSnap = await checkInRef.get();
    if (!checkInSnap.exists) {
        return { success: true };
    }

    const checkIn = checkInSnap.data() as CheckInRecord;
    await db.runTransaction(async (transaction) => {
        if (checkIn.seatId) {
            const occupancyRef = getOccupancyDoc(roomId, checkIn.seatId);
            const occupancySnap = await transaction.get(occupancyRef);
            if (occupancySnap.exists) {
                const occupancy = occupancySnap.data() as OccupancyRecord;
                if (occupancy.uid === uid) {
                    transaction.delete(occupancyRef);
                }
            }
        }

        transaction.delete(checkInRef);
    });

    return { success: true };
});

export const getNearbySeats = onCall({ cors: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const roomId = String(request.data?.roomId || "").trim();

    if (!roomId) {
        throw new HttpsError("invalid-argument", "roomId is required.");
    }

    const checkInSnap = await getCheckInDoc(roomId, uid).get();
    if (!checkInSnap.exists) {
        throw new HttpsError("failed-precondition", "You are not checked into this room.");
    }

    const checkIn = checkInSnap.data() as CheckInRecord;
    const seats = await loadRoomSeats(roomId);
    const seatMap = buildSeatMap(seats);
    const viewerSeat = seatMap.get(checkIn.seatId);

    if (!viewerSeat) {
        throw new HttpsError("not-found", "Viewer seat could not be resolved.");
    }

    const nearbySeats = getNearbySeatsForViewer(viewerSeat, seats);
    const occupancyMap = await loadRoomOccupancy(roomId);

    const minRow = Math.min(...nearbySeats.map((seat) => seat.rowIndex));
    const maxRow = Math.max(...nearbySeats.map((seat) => seat.rowIndex));
    const minCol = Math.min(...nearbySeats.map((seat) => seat.colIndex));
    const maxCol = Math.max(...nearbySeats.map((seat) => seat.colIndex));

    return {
        roomId,
        viewerSeat: {
            seatId: viewerSeat.seatId,
            label: viewerSeat.label,
            rowIndex: viewerSeat.rowIndex,
            colIndex: viewerSeat.colIndex,
        },
        minRow,
        maxRow,
        minCol,
        maxCol,
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
});

export const getNearbyStudentProfile = onCall({ cors: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const roomId = String(request.data?.roomId || "").trim();
    const targetUid = String(request.data?.targetUid || "").trim();

    if (!roomId || !targetUid) {
        throw new HttpsError("invalid-argument", "roomId and targetUid are required.");
    }

    const checkInSnap = await getCheckInDoc(roomId, uid).get();
    if (!checkInSnap.exists) {
        throw new HttpsError("failed-precondition", "You are not checked into this room.");
    }

    const checkIn = checkInSnap.data() as CheckInRecord;
    const seats = await loadRoomSeats(roomId);
    const seatMap = buildSeatMap(seats);
    const viewerSeat = seatMap.get(checkIn.seatId);
    if (!viewerSeat) {
        throw new HttpsError("not-found", "Viewer seat could not be resolved.");
    }

    const nearbySeatIds = new Set(getAdjacentSeatIdsForViewer(viewerSeat));

    const occupancyMap = await loadRoomOccupancy(roomId);
    const nearbyOccupant = Array.from(occupancyMap.values()).find(
        (occupancy) => nearbySeatIds.has(occupancy.seatId) && occupancy.uid === targetUid
    );

    if (!nearbyOccupant) {
        throw new HttpsError("permission-denied", "Target student is not currently adjacent.");
    }

    const profile = await loadUserProfile(targetUid);

    return {
        uid: targetUid,
        firstName: String(profile.name || "Student").trim().split(/\s+/)[0] || "Student",
        year: String(profile.year || ""),
        major: String(profile.major || ""),
        interests: String(profile.interests || ""),
        funFact: String(profile.funFact || ""),
        avatarType: String(profile.avatarType || "emoji"),
        avatarUri: (profile.avatarUri as string | null) ?? null,
        emoji: String(profile.emoji || "😊"),
    };
});
