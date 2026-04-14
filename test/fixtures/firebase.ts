import { deleteApp, initializeApp } from "firebase/app";
import {
    Auth,
    connectAuthEmulator,
    getAuth,
    signInAnonymously,
} from "firebase/auth";
import {
    Firestore,
    connectFirestoreEmulator,
    doc,
    getDoc,
    getFirestore,
    setDoc,
} from "firebase/firestore";
import {
    Functions,
    connectFunctionsEmulator,
    getFunctions,
    httpsCallable,
} from "firebase/functions";
import { UserFixture } from "./scenario";

export const EMULATOR_PROJECT_ID = "demo-wh0ru-aga1n";
const EMULATOR_HOST = "127.0.0.1";
const FIRESTORE_PORT = 8080;
const AUTH_PORT = 9099;
const FUNCTIONS_PORT = 5001;

let appCounter = 0;

export interface EmulatorClient {
    auth: Auth;
    db: Firestore;
    functions: Functions;
    uid: string;
    cleanup: () => Promise<void>;
}

function createFirebaseApp(name: string) {
    return initializeApp(
        {
            apiKey: "demo-api-key",
            appId: `demo-app-${name}`,
            authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
            projectId: EMULATOR_PROJECT_ID,
        },
        name
    );
}

async function createClient(label: string) {
    const appName = `${label}-${appCounter += 1}`;
    const app = createFirebaseApp(appName);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const functions = getFunctions(app);

    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_PORT}`, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_PORT);
    connectFunctionsEmulator(functions, EMULATOR_HOST, FUNCTIONS_PORT);

    const credential = await signInAnonymously(auth);

    return {
        auth,
        db,
        functions,
        uid: credential.user.uid,
        cleanup: async () => {
            await deleteApp(app);
        },
    } satisfies EmulatorClient;
}

export async function createStudentClient(
    fixture?: Partial<UserFixture> & { createProfile?: boolean }
) {
    const client = await createClient(fixture?.label ?? "student");

    if (fixture?.createProfile) {
        await setOwnUserDoc(client, {
            label: fixture.label ?? "student",
            userType: "student",
            name: fixture.name ?? "Student Tester",
            year: fixture.year ?? "Senior",
            major: fixture.major ?? "CS",
            interests: fixture.interests ?? "Testing",
            funFact: fixture.funFact ?? "Writes failing tests on purpose",
            emoji: fixture.emoji ?? "🧪",
            avatarType: fixture.avatarType ?? "emoji",
            avatarUri: fixture.avatarUri ?? null,
        });
    }

    return client;
}

export async function createProfessorClient(fixture?: Partial<UserFixture>) {
    const client = await createClient(fixture?.label ?? "professor");

    await setOwnUserDoc(client, {
        label: fixture?.label ?? "professor",
        userType: "professor",
        name: fixture?.name ?? "Professor Tester",
        emoji: fixture?.emoji ?? "🧑‍🏫",
        avatarType: fixture?.avatarType ?? "emoji",
        avatarUri: fixture?.avatarUri ?? null,
    });

    return client;
}

export async function setOwnUserDoc(client: EmulatorClient, fixture: UserFixture) {
    await setDoc(doc(client.db, "users", client.uid), {
        name: fixture.name ?? fixture.label,
        userType: fixture.userType,
        emoji: fixture.emoji ?? "😊",
        avatarType: fixture.avatarType ?? "emoji",
        avatarUri: fixture.avatarUri ?? null,
        year: fixture.year ?? "",
        major: fixture.major ?? "",
        interests: fixture.interests ?? "",
        funFact: fixture.funFact ?? "",
        updatedAt: new Date().toISOString(),
    });
}

export async function writeRoomLayout(
    client: EmulatorClient,
    roomId: string,
    layout: { name: string; rows: number; seatsPerSection: number; sections: 1 | 2 | 3 | 4 }
) {
    await setDoc(doc(client.db, "rooms", roomId), { layout }, { merge: true });
}

export async function callSyncRoomManifest(client: EmulatorClient, roomId: string) {
    const callable = httpsCallable<{ roomId: string }, { success: boolean }>(
        client.functions,
        "syncRoomManifest"
    );

    return callable({ roomId });
}

export async function callCheckInToSeat(client: EmulatorClient, tagId: string) {
    const callable = httpsCallable<
        { tagId: string; method: "qr" | "nfc" },
        { roomId: string; seatId: string; seatLabel: string }
    >(client.functions, "checkInToSeat");

    return callable({ tagId, method: "qr" });
}

export async function callLeaveSeat(client: EmulatorClient, roomId: string) {
    const callable = httpsCallable<{ roomId: string }, { success: boolean }>(
        client.functions,
        "leaveSeat"
    );

    return callable({ roomId });
}

export async function callGetNearbySeats(client: EmulatorClient, roomId: string) {
    const callable = httpsCallable(client.functions, "getNearbySeats");
    return callable({ roomId });
}

export async function callGetNearbyStudentProfile(
    client: EmulatorClient,
    roomId: string,
    targetUid: string
) {
    const callable = httpsCallable(client.functions, "getNearbyStudentProfile");
    return callable({ roomId, targetUid });
}

export async function readDoc(client: EmulatorClient, ...pathSegments: string[]) {
    const snapshot = await getDoc(doc(client.db, ...pathSegments));
    return snapshot.exists() ? snapshot.data() : null;
}

export async function resetEmulators() {
    await Promise.all([
        fetch(
            `http://${EMULATOR_HOST}:${AUTH_PORT}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`,
            { method: "DELETE" }
        ),
        fetch(
            `http://${EMULATOR_HOST}:${FIRESTORE_PORT}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`,
            { method: "DELETE" }
        ),
    ]);
}
