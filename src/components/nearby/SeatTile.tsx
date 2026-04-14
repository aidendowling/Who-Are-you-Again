import { forwardRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NearbySeatCard } from "../../lib/proximityApi";

interface SeatTileProps {
    seat: NearbySeatCard;
    isSelected?: boolean;
    selfPreview?: {
        firstName: string;
        year: string;
        major: string;
        avatarType: string;
        avatarUri: string | null;
        emoji: string;
    };
    onPress?: () => void;
}

export const SeatTile = forwardRef<View, SeatTileProps>(function SeatTile(
    { seat, isSelected, onPress, selfPreview },
    ref
) {
    const preview = seat.status === "self" ? selfPreview : seat.preview;
    const interactive = seat.status === "occupied";

    return (
        <Pressable
            ref={ref}
            onPress={interactive ? onPress : undefined}
            style={({ pressed }) => [
                styles.tile,
                seat.status === "self" && styles.selfTile,
                seat.status === "occupied" && styles.occupiedTile,
                seat.status === "empty" && styles.emptyTile,
                isSelected && styles.selectedTile,
                pressed && interactive && styles.pressedTile,
            ]}
        >
            <Text style={styles.label}>{seat.label}</Text>

            {seat.status === "empty" ? (
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyDesk}>🪑</Text>
                    <Text style={styles.emptyText}>Empty Desk</Text>
                </View>
            ) : (
                <View style={styles.content}>
                    {preview?.avatarType === "photo" && preview.avatarUri ? (
                        <Image source={{ uri: preview.avatarUri }} style={styles.avatar} />
                    ) : (
                        <View style={styles.emojiWrap}>
                            <Text style={styles.emoji}>{preview?.emoji || "😊"}</Text>
                        </View>
                    )}
                    <Text style={styles.name}>{seat.status === "self" ? "You" : preview?.firstName || "Student"}</Text>
                    <Text style={styles.meta} numberOfLines={2}>
                        {[preview?.year, preview?.major].filter(Boolean).join(" • ") || "Nearby student"}
                    </Text>
                </View>
            )}
        </Pressable>
    );
});

const styles = StyleSheet.create({
    tile: {
        minHeight: 112,
        borderRadius: 20,
        borderWidth: 1,
        padding: 12,
        justifyContent: "space-between",
        backgroundColor: "#fff",
    },
    selfTile: {
        backgroundColor: "#1e3a5f",
        borderColor: "#1e3a5f",
    },
    occupiedTile: {
        backgroundColor: "#fafaf8",
        borderColor: "#e4e5de",
    },
    emptyTile: {
        backgroundColor: "#f3f5f8",
        borderColor: "#dde2e9",
    },
    selectedTile: {
        opacity: 0,
    },
    pressedTile: {
        transform: [{ scale: 0.98 }],
    },
    label: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.1,
        textTransform: "uppercase",
        color: "#8d94a3",
    },
    content: {
        gap: 6,
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
    },
    emojiWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    emoji: {
        fontSize: 22,
    },
    name: {
        fontSize: 17,
        fontWeight: "800",
        color: "#111",
    },
    meta: {
        fontSize: 12,
        color: "#6e7583",
        lineHeight: 18,
    },
    emptyWrap: {
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 6,
    },
    emptyDesk: {
        fontSize: 28,
    },
    emptyText: {
        fontSize: 12,
        color: "#748093",
        textTransform: "uppercase",
        letterSpacing: 1,
        fontWeight: "700",
    },
});
