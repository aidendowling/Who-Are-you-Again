import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, initializeAuth, type Persistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

const reactNativeAsyncStoragePersistence: Persistence = {
    type: "LOCAL",
    async _isAvailable() {
        try {
            await AsyncStorage.setItem("__firebase_auth_test__", "1");
            await AsyncStorage.removeItem("__firebase_auth_test__");
            return true;
        } catch {
            return false;
        }
    },
    async _set(key: string, value: string) {
        await AsyncStorage.setItem(key, value);
    },
    async _get<T>(key: string) {
        return (await AsyncStorage.getItem(key)) as T | null;
    },
    async _remove(key: string) {
        await AsyncStorage.removeItem(key);
    },
    _addListener() {},
    _removeListener() {},
} as Persistence;

const createAuth = () => {
    if (Platform.OS === "web") {
        return getAuth(app);
    }

    try {
        return initializeAuth(app, {
            persistence: reactNativeAsyncStoragePersistence,
        });
    } catch {
        // Falls back when auth was already initialized (e.g. fast refresh).
        return getAuth(app);
    }
};

export const db = getFirestore(app);
export const auth = createAuth();
export default app;
