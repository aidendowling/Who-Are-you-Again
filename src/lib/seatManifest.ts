import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { buildSeatManifest, DEFAULT_LAYOUT, LayoutConfig, RoomSeat } from "./seating";

interface RoomMetadata {
    layout?: Partial<LayoutConfig>;
    layoutName?: string;
}

function coerceLayout(data?: Partial<LayoutConfig>) {
    if (!data?.rows || !data?.seatsPerSection || !data?.sections) {
        return DEFAULT_LAYOUT;
    }

    return {
        name: data.name || DEFAULT_LAYOUT.name,
        rows: data.rows,
        seatsPerSection: data.seatsPerSection,
        sections: data.sections as 1 | 2 | 3 | 4,
    };
}

async function loadRoomLayout(roomId: string) {
    const roomSnap = await getDoc(doc(db, "rooms", roomId));
    const roomData = roomSnap.exists() ? (roomSnap.data() as RoomMetadata) : undefined;

    return {
        roomRef: doc(db, "rooms", roomId),
        layout: coerceLayout(roomData?.layout),
    };
}

export async function syncSeatManifest(roomId: string, layoutOverride?: LayoutConfig) {
    const { roomRef, layout } = await loadRoomLayout(roomId);
    const resolvedLayout = layoutOverride ?? layout;
    const seats = buildSeatManifest(roomId, resolvedLayout);

    const existingSeatSnaps = await getDocs(collection(db, "rooms", roomId, "seats"));
    const existingTagSnaps = await getDocs(collection(db, "rooms", roomId, "seatTags"));
    const nextSeatIds = new Set(seats.map((seat) => seat.seatId));
    const nextTagIds = new Set(seats.map((seat) => seat.tagId));

    const batch = writeBatch(db);

    batch.set(
        roomRef,
        {
            layout: resolvedLayout,
            layoutName: resolvedLayout.name,
            layoutVersion: 2,
            frontOrientation: "row-ascending-from-podium",
            seatCount: seats.length,
            updatedAt: new Date().toISOString(),
        },
        { merge: true }
    );

    for (const seat of seats) {
        batch.set(
            doc(db, "rooms", roomId, "seats", seat.seatId),
            {
                seatId: seat.seatId,
                label: seat.label,
                rowIndex: seat.rowIndex,
                colIndex: seat.colIndex,
                sectionIndex: seat.sectionIndex,
                isActive: seat.isActive,
                tagId: seat.tagId,
                legacyLabels: seat.legacyLabels,
                roomId,
                updatedAt: new Date().toISOString(),
            },
            { merge: true }
        );

        batch.set(
            doc(db, "rooms", roomId, "seatTags", seat.tagId),
            {
                tagId: seat.tagId,
                roomId,
                seatId: seat.seatId,
                method: "qr",
                isActive: true,
                updatedAt: new Date().toISOString(),
            },
            { merge: true }
        );
    }

    existingSeatSnaps.forEach((seatDoc) => {
        if (!nextSeatIds.has(seatDoc.id)) {
            batch.delete(seatDoc.ref);
        }
    });

    existingTagSnaps.forEach((tagDoc) => {
        if (!nextTagIds.has(tagDoc.id)) {
            batch.delete(tagDoc.ref);
        }
    });

    await batch.commit();

    return seats;
}

export async function getOrCreateSeatManifest(roomId: string, layoutOverride?: LayoutConfig) {
    const seatSnaps = await getDocs(collection(db, "rooms", roomId, "seats"));
    if (seatSnaps.size > 0 && !layoutOverride) {
        return seatSnaps.docs.map((seatDoc) => seatDoc.data() as RoomSeat);
    }

    return syncSeatManifest(roomId, layoutOverride);
}

export async function clearRoomOccupancy(roomId: string) {
    const occupancySnaps = await getDocs(collection(db, "rooms", roomId, "occupancy"));
    await Promise.all(occupancySnaps.docs.map((seatDoc) => deleteDoc(seatDoc.ref)));
}
