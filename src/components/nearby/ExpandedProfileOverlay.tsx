import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
    SharedValue,
    interpolate,
    useAnimatedStyle,
} from "react-native-reanimated";
import { NearbyStudentProfile } from "../../lib/proximityApi";

interface CardLayout {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ExpandedProfileOverlayProps {
    visible: boolean;
    progress: SharedValue<number>;
    origin: CardLayout | null;
    seatLabel?: string;
    profile: NearbyStudentProfile | null;
    isLoading: boolean;
    isUnavailable: boolean;
    onClose: () => void;
}

export function ExpandedProfileOverlay({
    visible,
    progress,
    origin,
    seatLabel,
    profile,
    isLoading,
    isUnavailable,
    onClose,
}: ExpandedProfileOverlayProps) {
    const { width, height } = useWindowDimensions();
    const target = {
        x: 16,
        y: 52,
        width: width - 32,
        height: Math.min(height - 104, 440),
    };

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 1], [0, 1]),
    }));

    const cardStyle = useAnimatedStyle(() => {
        if (!origin) return { opacity: 0 };

        return {
            position: "absolute",
            left: interpolate(progress.value, [0, 1], [origin.x, target.x]),
            top: interpolate(progress.value, [0, 1], [origin.y, target.y]),
            width: interpolate(progress.value, [0, 1], [origin.width, target.width]),
            height: interpolate(progress.value, [0, 1], [origin.height, target.height]),
            borderRadius: interpolate(progress.value, [0, 1], [20, 28]),
        };
    });

    if (!visible || !origin) {
        return null;
    }

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[styles.backdrop, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>
            <Animated.View style={[styles.card, cardStyle]}>
                <View style={styles.handle} />
                <View style={styles.header}>
                    <Text style={styles.headerLabel}>{seatLabel || "Nearby Seat"}</Text>
                    <Pressable onPress={onClose} hitSlop={12}>
                        <Text style={styles.closeText}>Close</Text>
                    </Pressable>
                </View>

                {isLoading ? (
                    <View style={styles.centerBody}>
                        <Text style={styles.title}>Loading Profile…</Text>
                        <Text style={styles.body}>Fetching the expanded view for this adjacent student.</Text>
                    </View>
                ) : isUnavailable ? (
                    <View style={styles.centerBody}>
                        <Text style={styles.title}>No Longer Nearby</Text>
                        <Text style={styles.body}>
                            This seat is no longer occupied by the same adjacent student, so Synapse is not exposing the profile.
                        </Text>
                    </View>
                ) : profile ? (
                    <View style={styles.content}>
                        {profile.avatarType === "photo" && profile.avatarUri ? (
                            <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
                        ) : (
                            <View style={styles.emojiAvatar}>
                                <Text style={styles.emoji}>{profile.emoji}</Text>
                            </View>
                        )}
                        <Text style={styles.name}>{profile.firstName}</Text>
                        <Text style={styles.subtitle}>
                            {[profile.year, profile.major].filter(Boolean).join(" • ")}
                        </Text>

                        <View style={styles.infoCard}>
                            <Text style={styles.infoLabel}>Interests</Text>
                            <Text style={styles.infoBody}>
                                {profile.interests || "No interests shared."}
                            </Text>
                        </View>

                        <View style={styles.infoCard}>
                            <Text style={styles.infoLabel}>Fun Fact</Text>
                            <Text style={styles.infoBody}>
                                {profile.funFact || "No fun fact shared."}
                            </Text>
                        </View>
                    </View>
                ) : null}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(11, 18, 32, 0.54)",
    },
    card: {
        backgroundColor: "#fafaf8",
        borderWidth: 1,
        borderColor: "#e2e4df",
        overflow: "hidden",
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    handle: {
        width: 42,
        height: 4,
        borderRadius: 999,
        backgroundColor: "#d4d7de",
        alignSelf: "center",
        marginTop: 12,
        marginBottom: 18,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    headerLabel: {
        fontSize: 12,
        color: "#7d8796",
        textTransform: "uppercase",
        letterSpacing: 1.3,
        fontWeight: "700",
    },
    closeText: {
        fontSize: 14,
        color: "#1e3a5f",
        fontWeight: "700",
    },
    centerBody: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingBottom: 32,
    },
    content: {
        alignItems: "center",
        gap: 14,
    },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
        marginTop: 4,
    },
    emojiAvatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#e8edf6",
    },
    emoji: {
        fontSize: 42,
    },
    name: {
        fontSize: 30,
        fontWeight: "900",
        color: "#111",
    },
    title: {
        fontSize: 24,
        fontWeight: "900",
        color: "#111",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 15,
        color: "#5f6876",
        textAlign: "center",
    },
    body: {
        fontSize: 14,
        lineHeight: 20,
        color: "#5f6876",
        textAlign: "center",
    },
    infoCard: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#e8ebef",
        padding: 16,
        gap: 6,
    },
    infoLabel: {
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: "#8b93a2",
        fontWeight: "700",
    },
    infoBody: {
        fontSize: 15,
        color: "#1f2937",
        lineHeight: 22,
    },
});
