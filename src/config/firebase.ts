import { getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth, initializeAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// getReactNativePersistence is available at runtime in the React Native bundle
// but is not in the default firebase/auth TypeScript types — require() bypasses this.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { getReactNativePersistence } = require("firebase/auth") as any;

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function resolveEmulatorHost() {
    if (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST) {
        return process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
    }

    return Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";
}

function shouldUseFirebaseEmulators() {
    return process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "1";
}

const createAuth = () => {
    if (Platform.OS === "web") {
        return getAuth(app);
    }

    try {
        return initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
        });
    } catch {
        // Falls back when auth was already initialized (e.g. fast refresh).
        return getAuth(app);
    }
};

export const db = getFirestore(app);
export const auth = createAuth();
export const functions = getFunctions(app);

const emulatorState = globalThis as typeof globalThis & {
    __wh0ruFirebaseEmulatorsConnected?: boolean;
};

if (shouldUseFirebaseEmulators() && !emulatorState.__wh0ruFirebaseEmulatorsConnected) {
    const host = resolveEmulatorHost();
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectFunctionsEmulator(functions, host, 5001);
    emulatorState.__wh0ruFirebaseEmulatorsConnected = true;
}

export default app;
