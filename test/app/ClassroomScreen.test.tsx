import { render, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getDoc, onSnapshot } from "firebase/firestore";
import ClassroomScreen from "../../src/screens/ClassroomScreen";
import { ensureAnonymousUid } from "../../src/utils/auth";

jest.mock("../../src/utils/auth", () => ({
    ensureAnonymousUid: jest.fn(),
}));

jest.mock("../../src/lib/proximityApi", () => ({
    fetchNearbySeats: jest.fn(),
    leaveSeat: jest.fn(),
}));

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockEnsureAnonymousUid = ensureAnonymousUid as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockOnSnapshot = onSnapshot as jest.Mock;

describe("ClassroomScreen", () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        mockUseRouter.mockReturnValue({
            dismissAll: jest.fn(),
            push: jest.fn(),
            replace: jest.fn(),
        });
        mockEnsureAnonymousUid.mockResolvedValue("student-uid");
        mockGetDoc.mockResolvedValue({
            exists: () => false,
            data: () => ({}),
        });
        mockOnSnapshot.mockImplementation(() => jest.fn());
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it("shows an empty state when no classroom is selected", () => {
        mockUseLocalSearchParams.mockReturnValue({});

        const screen = render(<ClassroomScreen />);

        expect(screen.getByText("No classroom selected")).toBeTruthy();
        expect(screen.getByText("Scan a Desk")).toBeTruthy();
    });

    it("renders the active classroom state from profile and room snapshots", async () => {
        mockUseLocalSearchParams.mockReturnValue({
            roomId: "test-room",
            seatId: "r0c0",
            seatLabel: "1A",
        });
        mockEnsureAnonymousUid.mockResolvedValue("student-uid");
        mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                name: "Casey Student",
                emoji: "🧪",
                avatarType: "emoji",
                avatarUri: null,
                major: "Computer Science",
                year: "Senior",
            }),
        });
        mockOnSnapshot.mockImplementation((ref: string, callback: (snapshot: unknown) => void) => {
            if (ref.includes("/checkins/")) {
                callback({
                    exists: () => true,
                    data: () => ({
                        seatId: "r0c0",
                        seatLabel: "1A",
                        handRaised: true,
                    }),
                });
            } else {
                callback({
                    exists: () => true,
                    data: () => ({
                        layoutName: "Test Layout",
                        seatCount: 48,
                    }),
                });
            }

            return jest.fn();
        });

        const screen = render(<ClassroomScreen />);

        await waitFor(() => {
            expect(screen.getByText("Casey Student")).toBeTruthy();
        });

        expect(screen.getByText("Test Classroom")).toBeTruthy();
        expect(screen.getByText("Seat 1A · Test Layout")).toBeTruthy();
        expect(screen.getByText("48")).toBeTruthy();
    });
});
