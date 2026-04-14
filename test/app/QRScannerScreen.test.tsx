import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import { getDoc } from "firebase/firestore";
import QRScannerScreen from "../../src/screens/QRScannerScreen";
import { bootstrapTestRoom, isTestSupportEnabled } from "../../src/lib/testSupport";
import { ensureAnonymousUid } from "../../src/utils/auth";

jest.mock("../../src/lib/proximityApi", () => ({
    checkInToSeat: jest.fn(),
    syncRoomManifest: jest.fn(),
}));

jest.mock("../../src/lib/testSupport", () => ({
    bootstrapTestRoom: jest.fn(),
    isTestSupportEnabled: jest.fn(() => true),
}));

jest.mock("../../src/utils/auth", () => ({
    ensureAnonymousUid: jest.fn(),
}));

const mockUseRouter = useRouter as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockBootstrapTestRoom = bootstrapTestRoom as jest.Mock;
const mockEnsureAnonymousUid = ensureAnonymousUid as jest.Mock;
const mockIsTestSupportEnabled = isTestSupportEnabled as jest.Mock;

describe("QRScannerScreen", () => {
    it("routes a student into the bootstrapped test classroom", async () => {
        const push = jest.fn();
        mockUseRouter.mockReturnValue({ push });
        mockEnsureAnonymousUid.mockResolvedValue("student-uid");
        mockGetDoc.mockResolvedValue({ exists: () => false });
        mockIsTestSupportEnabled.mockReturnValue(true);
        mockBootstrapTestRoom.mockResolvedValue({
            ok: true,
            route: "classroom",
            roomId: "test-room",
            seatId: "r0c0",
            seatLabel: "1A",
        });

        const screen = render(<QRScannerScreen />);

        fireEvent.press(screen.getByText("Skip — Use Test Room"));

        await waitFor(() => {
            expect(mockBootstrapTestRoom).toHaveBeenCalledWith("student");
        });
        expect(push).toHaveBeenCalledWith("/classroom?roomId=test-room&seatId=r0c0&seatLabel=1A");
    });

    it("routes a professor into the test room dashboard", async () => {
        const push = jest.fn();
        mockUseRouter.mockReturnValue({ push });
        mockEnsureAnonymousUid.mockResolvedValue("professor-uid");
        mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ userType: "professor" }),
        });
        mockBootstrapTestRoom.mockResolvedValue({
            ok: true,
            route: "professor",
            roomId: "test-room",
        });

        const screen = render(<QRScannerScreen />);

        fireEvent.press(screen.getByText("Skip — Use Test Room"));

        await waitFor(() => {
            expect(mockBootstrapTestRoom).toHaveBeenCalledWith("professor");
        });
        expect(push).toHaveBeenCalledWith("/professor?roomId=test-room");
    });
});
