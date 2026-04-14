import type { MutableRefObject } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { NearbySeatCard, NearbySeatsResponse } from "../../lib/proximityApi";
import { SeatTile } from "./SeatTile";

interface NearbyGridProps {
    nearby: NearbySeatsResponse;
    selectedSeatId?: string | null;
    selfPreview?: {
        firstName: string;
        year: string;
        major: string;
        avatarType: string;
        avatarUri: string | null;
        emoji: string;
    };
    seatRefs: MutableRefObject<Record<string, View | null>>;
    onSeatPress: (seat: NearbySeatCard) => void;
}

export function NearbyGrid({
    nearby,
    selectedSeatId,
    selfPreview,
    seatRefs,
    onSeatPress,
}: NearbyGridProps) {
    const { width } = useWindowDimensions();
    const columns = Array.from(
        { length: nearby.maxCol - nearby.minCol + 1 },
        (_, index) => nearby.minCol + index
    );
    const rows = Array.from(
        { length: nearby.maxRow - nearby.minRow + 1 },
        (_, index) => nearby.minRow + index
    );
    const seatMap = new Map(
        nearby.seats.map((seat) => [`${seat.rowIndex}:${seat.colIndex}`, seat])
    );

    const columnGap = 10;
    const tileWidth = Math.max(
        96,
        Math.floor((Math.min(width - 32, 360) - columnGap * (columns.length - 1)) / columns.length)
    );

    return (
        <View style={styles.grid}>
            {rows.map((rowIndex) => (
                <View key={rowIndex} style={[styles.row, { gap: columnGap }]}>
                    {columns.map((colIndex) => {
                        const seat = seatMap.get(`${rowIndex}:${colIndex}`);
                        if (!seat) {
                            return <View key={`${rowIndex}:${colIndex}`} style={{ width: tileWidth }} />;
                        }

                        return (
                            <View key={seat.seatId} style={{ width: tileWidth }}>
                                <SeatTile
                                    ref={(node) => {
                                        seatRefs.current[seat.seatId] = node;
                                    }}
                                    seat={seat}
                                    selfPreview={selfPreview}
                                    isSelected={selectedSeatId === seat.seatId}
                                    onPress={() => onSeatPress(seat)}
                                />
                            </View>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        alignItems: "center",
        gap: 10,
    },
    row: {
        flexDirection: "row",
        justifyContent: "center",
    },
});
