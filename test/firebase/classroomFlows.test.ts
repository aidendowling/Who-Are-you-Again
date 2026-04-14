import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { doc, setDoc } from "firebase/firestore";
import {
    callCheckInToSeat,
    callGetNearbySeats,
    callGetNearbyStudentProfile,
    callLeaveSeat,
    callSyncRoomManifest,
    createProfessorClient,
    createStudentClient,
    EmulatorClient,
    readDoc,
    resetEmulators,
    writeRoomLayout,
} from "../fixtures/firebase";
import {
    createCheckInFixture,
    createRoomFixture,
} from "../fixtures/scenario";

const activeClients: EmulatorClient[] = [];

async function trackClient<T extends EmulatorClient>(clientPromise: Promise<T>) {
    const client = await clientPromise;
    activeClients.push(client);
    return client;
}

beforeEach(async () => {
    await resetEmulators();
});

afterEach(async () => {
    await Promise.all(activeClients.splice(0).map((client) => client.cleanup()));
});

test("anonymous student without a profile can enter the seeded test room deterministically", async () => {
    const student = await trackClient(createStudentClient({ label: "anon-student" }));
    const room = createRoomFixture({ roomId: "test-room" });
    const seat = createCheckInFixture(room, "1A");

    await callSyncRoomManifest(student, room.roomId);
    const result = await callCheckInToSeat(student, seat.tagId);

    assert.equal(result.data.roomId, room.roomId);
    assert.equal(result.data.seatLabel, "1A");

    const checkIn = await readDoc(student, "rooms", room.roomId, "checkins", student.uid);
    assert.equal(checkIn?.seatLabel, "1A");
  });

test("syncRoomManifest writes room metadata, seats, and seat tags from the shared layout model", async () => {
    const professor = await trackClient(createProfessorClient({ label: "layout-professor" }));
    const room = createRoomFixture({
        roomId: "layout-room",
        layout: {
            name: "Lecture Hall",
            rows: 2,
            seatsPerSection: 2,
            sections: 2,
        },
    });

    await writeRoomLayout(professor, room.roomId, room.layout);
    await callSyncRoomManifest(professor, room.roomId);

    const roomDoc = await readDoc(professor, "rooms", room.roomId);
    const seatDoc = await readDoc(professor, "rooms", room.roomId, "seats", "r0c3");
    const tagDoc = await readDoc(professor, "rooms", room.roomId, "seatTags", "qr-layout-room-r0c3");

    assert.equal(roomDoc?.layoutName, "Lecture Hall");
    assert.equal(roomDoc?.seatCount, 8);
    assert.equal(seatDoc?.label, "1D");
    assert.equal(tagDoc?.roomId, room.roomId);
});

test("checkInToSeat creates occupancy, moves active seats, and blocks collisions", async () => {
    const professor = await trackClient(createProfessorClient({ label: "collision-professor" }));
    const studentA = await trackClient(createStudentClient({
        label: "student-a",
        createProfile: true,
        name: "Alice Example",
        year: "Junior",
        major: "CS",
    }));
    const studentB = await trackClient(createStudentClient({
        label: "student-b",
        createProfile: true,
        name: "Bob Example",
    }));
    const room = createRoomFixture({ roomId: "collision-room" });
    const seatA = createCheckInFixture(room, "1A");
    const seatB = createCheckInFixture(room, "1B");

    await callSyncRoomManifest(studentA, room.roomId);
    await callCheckInToSeat(studentA, seatA.tagId);

    const firstOccupancy = await readDoc(professor, "rooms", room.roomId, "occupancy", seatA.seatId);
    assert.equal(firstOccupancy?.preview?.firstName, "Alice");

    await callCheckInToSeat(studentA, seatB.tagId);

    const clearedOccupancy = await readDoc(professor, "rooms", room.roomId, "occupancy", seatA.seatId);
    const movedOccupancy = await readDoc(professor, "rooms", room.roomId, "occupancy", seatB.seatId);
    assert.equal(clearedOccupancy, null);
    assert.equal(movedOccupancy?.uid, studentA.uid);

    await assert.rejects(
        () => callCheckInToSeat(studentB, seatB.tagId),
        /already occupied/
    );
});

test("leaveSeat only clears the caller occupancy and check-in", async () => {
    const professor = await trackClient(createProfessorClient({ label: "leave-professor" }));
    const studentA = await trackClient(createStudentClient({ label: "leave-a", createProfile: true }));
    const studentB = await trackClient(createStudentClient({ label: "leave-b", createProfile: true }));
    const room = createRoomFixture({ roomId: "leave-room" });
    const seatA = createCheckInFixture(room, "1A");
    const seatB = createCheckInFixture(room, "1B");

    await callSyncRoomManifest(studentA, room.roomId);
    await callCheckInToSeat(studentA, seatA.tagId);
    await callCheckInToSeat(studentB, seatB.tagId);

    await callLeaveSeat(studentA, room.roomId);

    assert.equal(await readDoc(studentA, "rooms", room.roomId, "checkins", studentA.uid), null);
    assert.equal(await readDoc(professor, "rooms", room.roomId, "occupancy", seatA.seatId), null);
    assert.equal(
        (await readDoc(professor, "rooms", room.roomId, "occupancy", seatB.seatId))?.uid,
        studentB.uid
    );
});

test("getNearbySeats returns only self, adjacent occupants, and visible empty seats", async () => {
    const viewer = await trackClient(createStudentClient({
        label: "viewer",
        createProfile: true,
        name: "Viewer Student",
    }));
    const adjacent = await trackClient(createStudentClient({
        label: "adjacent",
        createProfile: true,
        name: "Ada Lovelace",
    }));
    const diagonal = await trackClient(createStudentClient({
        label: "diagonal",
        createProfile: true,
        name: "Grace Hopper",
    }));
    const distant = await trackClient(createStudentClient({
        label: "distant",
        createProfile: true,
        name: "Far Away",
    }));
    const room = createRoomFixture({
        roomId: "nearby-room",
        layout: {
            name: "Nearby Layout",
            rows: 4,
            seatsPerSection: 4,
            sections: 1,
        },
    });

    await callSyncRoomManifest(viewer, room.roomId);
    await callCheckInToSeat(viewer, createCheckInFixture(room, "2B").tagId);
    await callCheckInToSeat(adjacent, createCheckInFixture(room, "2C").tagId);
    await callCheckInToSeat(diagonal, createCheckInFixture(room, "1A").tagId);
    await callCheckInToSeat(distant, createCheckInFixture(room, "4D").tagId);

    const response = await callGetNearbySeats(viewer, room.roomId);
    const labels = response.data.seats.map((seat: { label: string }) => seat.label);
    const occupiedLabels = response.data.seats
        .filter((seat: { status: string }) => seat.status === "occupied")
        .map((seat: { label: string; preview?: { firstName: string } }) => `${seat.label}:${seat.preview?.firstName}`);

    assert.deepEqual(labels, ["1A", "1B", "1C", "2A", "2B", "2C", "3A", "3B", "3C"]);
    assert.deepEqual(occupiedLabels.sort(), ["1A:Grace", "2C:Ada"]);
    assert.ok(!labels.includes("4D"));
});

test("getNearbyStudentProfile only exposes adjacent occupants", async () => {
    const viewer = await trackClient(createStudentClient({ label: "viewer", createProfile: true }));
    const adjacent = await trackClient(createStudentClient({
        label: "adjacent",
        createProfile: true,
        name: "Nearby Person",
        funFact: "Adjacent and visible",
    }));
    const distant = await trackClient(createStudentClient({
        label: "distant",
        createProfile: true,
        name: "Not Nearby",
    }));
    const room = createRoomFixture({
        roomId: "profile-room",
        layout: {
            name: "Profile Layout",
            rows: 4,
            seatsPerSection: 4,
            sections: 1,
        },
    });

    await callSyncRoomManifest(viewer, room.roomId);
    await callCheckInToSeat(viewer, createCheckInFixture(room, "2B").tagId);
    await callCheckInToSeat(adjacent, createCheckInFixture(room, "2C").tagId);
    await callCheckInToSeat(distant, createCheckInFixture(room, "4D").tagId);

    const allowed = await callGetNearbyStudentProfile(viewer, room.roomId, adjacent.uid);
    assert.equal(allowed.data.firstName, "Nearby");
    assert.equal(allowed.data.funFact, "Adjacent and visible");

    await assert.rejects(
        () => callGetNearbyStudentProfile(viewer, room.roomId, distant.uid),
        /not currently adjacent/
    );
});

test("Firestore rules allow professor room writes and restrict students to handRaise updates", async () => {
    const professor = await trackClient(createProfessorClient({ label: "rules-professor" }));
    const student = await trackClient(createStudentClient({
        label: "rules-student",
        createProfile: true,
    }));
    const room = createRoomFixture({ roomId: "rules-room" });
    const viewerSeat = createCheckInFixture(room, "1A");

    await assert.rejects(
        () =>
            setDoc(doc(student.db, "rooms", room.roomId), {
                layout: room.layout,
            }),
        /permission-denied/
    );

    await setDoc(doc(professor.db, "rooms", room.roomId), { layout: room.layout }, { merge: true });
    await callSyncRoomManifest(professor, room.roomId);
    await callCheckInToSeat(student, viewerSeat.tagId);

    await setDoc(
        doc(student.db, "rooms", room.roomId, "checkins", student.uid),
        { handRaised: true },
        { merge: true }
    );

    const updatedCheckIn = await readDoc(student, "rooms", room.roomId, "checkins", student.uid);
    assert.equal(updatedCheckIn?.handRaised, true);

    await assert.rejects(
        () =>
            setDoc(
                doc(student.db, "rooms", room.roomId, "checkins", student.uid),
                { seatLabel: "9Z" },
                { merge: true }
            ),
        /permission-denied/
    );
});
