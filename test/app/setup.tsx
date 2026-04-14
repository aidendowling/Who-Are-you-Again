import type { ReactNode } from "react";

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

jest.mock("expo-router", () => ({
    useLocalSearchParams: jest.fn(),
    useRouter: jest.fn(),
}));

jest.mock("expo-camera", () => ({
    CameraView: "CameraView",
    useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

jest.mock("react-native-safe-area-context", () => {
    const React = require("react");
    const { View } = require("react-native");

    return {
        SafeAreaView: ({ children }: { children: ReactNode }) => <View>{children}</View>,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

jest.mock("../../src/config/firebase", () => ({
    db: {},
    functions: {},
}));

jest.mock("firebase/firestore", () => ({
    collectionGroup: jest.fn(),
    doc: jest.fn((...segments: string[]) => segments.join("/")),
    documentId: jest.fn(() => "__name__"),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    onSnapshot: jest.fn(),
    query: jest.fn((...args: unknown[]) => args),
    setDoc: jest.fn(),
    where: jest.fn((...args: unknown[]) => args),
}));
