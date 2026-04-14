import { render } from "@testing-library/react-native";
import { ExpandedProfileOverlay } from "../../src/components/nearby/ExpandedProfileOverlay";

describe("ExpandedProfileOverlay", () => {
    it("renders the unavailable state when the adjacent profile is stale", () => {
        const screen = render(
            <ExpandedProfileOverlay
                visible={true}
                progress={{ value: 1 } as never}
                origin={{ x: 0, y: 0, width: 120, height: 120 }}
                seatLabel="1A"
                profile={null}
                isLoading={false}
                isUnavailable={true}
                onClose={jest.fn()}
            />
        );

        expect(screen.getByText("No Longer Nearby")).toBeTruthy();
        expect(
            screen.getByText(
                "This seat is no longer occupied by the same adjacent student, so Synapse is not exposing the profile."
            )
        ).toBeTruthy();
    });
});
