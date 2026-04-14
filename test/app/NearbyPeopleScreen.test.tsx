import { render, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getDoc } from "firebase/firestore";
import NearbyPeopleScreen from "../../src/screens/NearbyPeopleScreen";
import { fetchNearbySeats } from "../../src/lib/proximityApi";
import { ensureAnonymousUid } from "../../src/utils/auth";

jest.mock("../../src/utils/auth", () => ({
    ensureAnonymousUid: jest.fn(),
}));

jest.mock("../../src/lib/proximityApi", () => ({
    fetchNearbySeats: jest.fn(),
    fetchNearbyStudentProfile: jest.fn(),
}));

jest.mock("../../src/components/nearby/NearbyGrid", () => ({
    NearbyGrid: ({ nearby }: { nearby: { seats: Array<{ label: string }> } }) => {
        const { Text, View } = require("react-native");

        return (
            <View>
            {nearby.seats.map((seat) => (
                <Text key={seat.label}>{seat.label}</Text>
            ))}
            </View>
        );
    },
}));

jest.mock("../../src/components/nearby/ExpandedProfileOverlay", () => ({
    ExpandedProfileOverlay: () => null,
}));

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockFetchNearbySeats = fetchNearbySeats as jest.Mock;
const mockEnsureAnonymousUid = ensureAnonymousUid as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;

describe("NearbyPeopleScreen", () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        mockUseRouter.mockReturnValue({ back: jest.fn() });
        mockEnsureAnonymousUid.mockResolvedValue("viewer-uid");
        mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                name: "Viewer Student",
                year: "Senior",
                major: "CS",
                avatarType: "emoji",
                avatarUri: null,
                emoji: "🧪",
            }),
        });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it("shows an error when the room id is missing", async () => {
        mockUseLocalSearchParams.mockReturnValue({});

        const screen = render(<NearbyPeopleScreen />);

        await waitFor(() => {
            expect(screen.getByText("Nearby grid unavailable")).toBeTruthy();
        });
        expect(screen.getByText("Missing roomId.")).toBeTruthy();
    });

    it("shows an error card when nearby data fails to load", async () => {
        mockUseLocalSearchParams.mockReturnValue({ roomId: "room-1" });
        mockFetchNearbySeats.mockRejectedValue(new Error("boom"));

        const screen = render(<NearbyPeopleScreen />);

        await waitFor(() => {
            expect(screen.getByText("Nearby grid unavailable")).toBeTruthy();
        });
        expect(
            screen.getByText("Could not load nearby seats. Make sure your seat check-in is active and the room manifest exists.")
        ).toBeTruthy();
    });

    it("renders a successful nearby grid state", async () => {
        mockUseLocalSearchParams.mockReturnValue({ roomId: "room-1" });
        mockFetchNearbySeats.mockResolvedValue({
            roomId: "room-1",
            viewerSeat: {
                seatId: "r1c1",
                label: "2B",
                rowIndex: 1,
                colIndex: 1,
            },
            minRow: 0,
            maxRow: 1,
            minCol: 0,
            maxCol: 1,
            seats: [
                { seatId: "r0c0", label: "1A", rowIndex: 0, colIndex: 0, status: "occupied" },
                { seatId: "r1c1", label: "2B", rowIndex: 1, colIndex: 1, status: "self" },
            ],
        });

        const screen = render(<NearbyPeopleScreen />);

        await waitFor(() => {
            expect(screen.getByText("People Nearby")).toBeTruthy();
        });

        expect(screen.getByText("Front of Room")).toBeTruthy();
        expect(screen.getByText("1A")).toBeTruthy();
        expect(screen.getByText("2B")).toBeTruthy();
    });
});
