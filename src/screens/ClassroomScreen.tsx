import { useEffect, useState } from "react";
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { db } from "../config/firebase";
import { fetchNearbySeats, leaveSeat } from "../lib/proximityApi";
import { ensureAnonymousUid } from "../utils/auth";

interface ProfileData {
    name: string;
    emoji: string;
    avatarType: string;
    avatarUri: string | null;
    major: string;
    year: string;
}

interface ActiveCheckIn {
    seatId: string;
    seatLabel: string;
    handRaised: boolean;
}

interface RoomMeta {
    layoutName?: string;
    seatCount?: number;
}

const DEFAULT_PROFILE: ProfileData = {
    name: "Student",
    emoji: "😊",
    avatarType: "emoji",
    avatarUri: null,
    major: "",
    year: "",
};

export default function ClassroomScreen() {
    const router = useRouter();
    const { roomId, seatId, seatLabel } = useLocalSearchParams<{
        roomId: string;
        seatId?: string;
        seatLabel?: string;
    }>();

    const [uid, setUid] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
    const [checkIn, setCheckIn] = useState<ActiveCheckIn | null>(
        seatId || seatLabel
            ? {
                  seatId: seatId || "",
                  seatLabel: seatLabel ? decodeURIComponent(seatLabel) : "—",
                  handRaised: false,
              }
            : null
    );
    const [roomMeta, setRoomMeta] = useState<RoomMeta>({});
    const [isLeaving, setIsLeaving] = useState(false);
    const [nearbyError, setNearbyError] = useState<string | null>(null);
    const [isOpeningNearby, setIsOpeningNearby] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            try {
                const resolvedUid = await ensureAnonymousUid();
                if (!isMounted) return;

                setUid(resolvedUid);

                const profileSnap = await getDoc(doc(db, "users", resolvedUid));
                if (profileSnap.exists() && isMounted) {
                    const data = profileSnap.data();
                    setProfile({
                        name: data.name || DEFAULT_PROFILE.name,
                        emoji: data.emoji || DEFAULT_PROFILE.emoji,
                        avatarType: data.avatarType || DEFAULT_PROFILE.avatarType,
                        avatarUri: data.avatarUri || null,
                        major: data.major || "",
                        year: data.year || "",
                    });
                }
            } catch (error) {
                console.log("Could not initialize classroom identity:", error);
            }
        };

        initialize();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!roomId || !uid) return;

        const checkInRef = doc(db, "rooms", roomId, "checkins", uid);
        const roomRef = doc(db, "rooms", roomId);

        const unsubscribeCheckIn = onSnapshot(checkInRef, (snapshot) => {
            if (!snapshot.exists()) {
                setCheckIn(null);
                return;
            }

            const data = snapshot.data();
            setCheckIn({
                seatId: data.seatId || "",
                seatLabel: data.seatLabel || data.seat || "—",
                handRaised: data.handRaised || false,
            });
        });

        const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
            if (!snapshot.exists()) return;

            const data = snapshot.data();
            setRoomMeta({
                layoutName: data.layoutName || data.layout?.name,
                seatCount: data.seatCount,
            });
        });

        return () => {
            unsubscribeCheckIn();
            unsubscribeRoom();
        };
    }, [roomId, uid]);

    const toggleHandRaise = async () => {
        if (!roomId || !uid || !checkIn) return;

        try {
            await setDoc(
                doc(db, "rooms", roomId, "checkins", uid),
                { handRaised: !checkIn.handRaised },
                { merge: true }
            );
        } catch (error) {
            console.log("Could not update hand raise:", error);
        }
    };

    const handleLeave = async () => {
        if (!roomId || isLeaving) return;

        setIsLeaving(true);
        try {
            await leaveSeat(roomId);
        } catch (error) {
            console.log("Could not leave seat:", error);
        } finally {
            setIsLeaving(false);
            router.dismissAll();
        }
    };

    const handleOpenNearby = async () => {
        if (!roomId || isOpeningNearby) return;

        setIsOpeningNearby(true);
        setNearbyError(null);

        try {
            // Prime the server-side adjacency lookup before navigating so broken state fails here.
            await fetchNearbySeats(roomId);
            router.push(`/nearby?roomId=${roomId}` as any);
        } catch (error) {
            console.log("Could not open nearby people:", error);
            setNearbyError("Nearby seats are not available until this room has a seat manifest and your check-in is active.");
        } finally {
            setIsOpeningNearby(false);
        }
    };

    if (!roomId) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No classroom selected</Text>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/scanner")}>
                        <Text style={styles.secondaryButtonText}>Scan a Desk</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.roomTitle}>
                            {roomId === "test-room" ? "Test Classroom" : `Room ${roomId}`}
                        </Text>
                        <Text style={styles.roomSubtitle}>
                            {checkIn?.seatLabel ? `Seat ${checkIn.seatLabel}` : "Seat not resolved"}
                            {roomMeta.layoutName ? ` · ${roomMeta.layoutName}` : ""}
                        </Text>
                    </View>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleLeave}
                        style={styles.leaveButton}
                        disabled={isLeaving}
                    >
                        <Text style={styles.leaveText}>{isLeaving ? "Leaving…" : "Leave"}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.profileCard}>
                    <Text style={styles.sectionLabel}>You</Text>
                    <View style={styles.profileRow}>
                        {profile.avatarType === "photo" && profile.avatarUri ? (
                            <Image source={{ uri: profile.avatarUri }} style={styles.profilePhoto} />
                        ) : (
                            <Text style={styles.profileEmoji}>{profile.emoji}</Text>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.profileName}>{profile.name}</Text>
                            {(profile.major || profile.year) && (
                                <Text style={styles.profileDetail}>
                                    {profile.major}
                                    {profile.major && profile.year ? " • " : ""}
                                    {profile.year}
                                </Text>
                            )}
                        </View>
                        <View style={[styles.seatBadge, checkIn?.handRaised && styles.seatBadgeActive]}>
                            <Text style={[styles.seatBadgeText, checkIn?.handRaised && styles.seatBadgeTextActive]}>
                                {checkIn?.seatLabel || "—"}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.metaCard}>
                    <Text style={styles.sectionLabel}>Room Context</Text>
                    <View style={styles.metaGrid}>
                        <View style={styles.metaCell}>
                            <Text style={styles.metaValue}>{roomMeta.seatCount ?? "—"}</Text>
                            <Text style={styles.metaLabel}>Physical Seats</Text>
                        </View>
                        <View style={styles.metaCell}>
                            <Text style={styles.metaValue}>{checkIn?.seatId || "—"}</Text>
                            <Text style={styles.metaLabel}>Seat ID</Text>
                        </View>
                    </View>
                </View>

                <RaiseHandButton raised={!!checkIn?.handRaised} onPress={toggleHandRaise} disabled={!checkIn} />

                {checkIn?.handRaised && (
                    <View style={styles.statusBar}>
                        <Text style={styles.statusText}>Hand raised. Only your active room check-in is being updated.</Text>
                    </View>
                )}

                <View style={styles.nearbyCard}>
                    <Text style={styles.sectionLabel}>Nearby</Text>
                    <Text style={styles.nearbyTitle}>See People Nearby</Text>
                    <Text style={styles.nearbyBody}>
                        Synapse only loads the seats directly around you. No room-wide student list is exposed here.
                    </Text>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleOpenNearby}
                        style={styles.primaryButton}
                        disabled={!checkIn || isOpeningNearby}
                    >
                        <Text style={styles.primaryButtonText}>
                            {isOpeningNearby ? "Opening…" : "Open Nearby Grid"}
                        </Text>
                    </TouchableOpacity>
                    {nearbyError ? <Text style={styles.inlineError}>{nearbyError}</Text> : null}
                </View>

                {!checkIn && (
                    <View style={styles.emptyStateCard}>
                        <Text style={styles.emptyTitle}>No active seat check-in</Text>
                        <Text style={styles.emptyBody}>
                            Your session is missing or stale. Scan the desk again before trying to use proximity networking.
                        </Text>
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/scanner")}>
                            <Text style={styles.secondaryButtonText}>Scan Again</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function RaiseHandButton({
    raised,
    onPress,
    disabled,
}: {
    raised: boolean;
    onPress: () => void;
    disabled?: boolean;
}) {
    const wobble = useSharedValue(0);

    useEffect(() => {
        if (!raised) {
            wobble.value = 0;
            return;
        }

        wobble.value = withRepeat(
            withSequence(
                withTiming(-5, { duration: 100, easing: Easing.ease }),
                withTiming(5, { duration: 200, easing: Easing.ease }),
                withTiming(0, { duration: 100, easing: Easing.ease })
            ),
            3,
            false
        );
    }, [raised, wobble]);

    const wobbleStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${wobble.value}deg` }],
    }));

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={[
                styles.handButton,
                raised && styles.handButtonActive,
                disabled && styles.buttonDisabled,
            ]}
            disabled={disabled}
        >
            <Animated.View style={[styles.handButtonInner, wobbleStyle]}>
                <Text style={styles.handEmoji}>{raised ? "✋" : "🤚"}</Text>
                <Text style={[styles.handText, raised && styles.handTextActive]}>
                    {raised ? "Lower Hand" : "Raise Hand"}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    scrollContent: {
        padding: 24,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
        gap: 12,
    },
    roomTitle: {
        fontSize: 28,
        fontWeight: "900",
        color: "#111",
    },
    roomSubtitle: {
        fontSize: 15,
        color: "#666",
        marginTop: 4,
    },
    leaveButton: {
        backgroundColor: "#f3f4f6",
        borderWidth: 1,
        borderColor: "#dde1e7",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 9,
    },
    leaveText: {
        fontSize: 14,
        color: "#4c5563",
        fontWeight: "600",
    },
    profileCard: {
        backgroundColor: "#fafaf8",
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: "#e7e7e2",
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 11,
        color: "#9aa0aa",
        textTransform: "uppercase",
        letterSpacing: 1.4,
        fontWeight: "700",
        marginBottom: 12,
    },
    profileRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    profileEmoji: {
        fontSize: 38,
    },
    profilePhoto: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    profileName: {
        fontSize: 20,
        fontWeight: "800",
        color: "#111",
    },
    profileDetail: {
        fontSize: 14,
        color: "#667084",
        marginTop: 2,
    },
    seatBadge: {
        backgroundColor: "#eef1f5",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    seatBadgeActive: {
        backgroundColor: "#1e3a5f",
    },
    seatBadgeText: {
        color: "#394150",
        fontWeight: "800",
        fontSize: 14,
    },
    seatBadgeTextActive: {
        color: "#fff",
    },
    metaCard: {
        backgroundColor: "#f7f8fa",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#e4e7ed",
        padding: 18,
        marginBottom: 16,
    },
    metaGrid: {
        flexDirection: "row",
        gap: 12,
    },
    metaCell: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#eceff4",
        padding: 14,
    },
    metaValue: {
        fontSize: 20,
        fontWeight: "800",
        color: "#1e3a5f",
        marginBottom: 6,
    },
    metaLabel: {
        fontSize: 12,
        color: "#7a8191",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    handButton: {
        backgroundColor: "#f5f5f5",
        borderRadius: 18,
        paddingVertical: 20,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: "#ececec",
    },
    handButtonActive: {
        backgroundColor: "#111",
        borderColor: "#111",
    },
    handButtonInner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    handEmoji: {
        fontSize: 28,
    },
    handText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#333",
    },
    handTextActive: {
        color: "#fff",
    },
    statusBar: {
        backgroundColor: "#fff7dd",
        borderWidth: 1,
        borderColor: "#f3df97",
        borderRadius: 14,
        padding: 12,
        marginBottom: 18,
    },
    statusText: {
        fontSize: 14,
        color: "#806318",
        textAlign: "center",
        fontWeight: "600",
        lineHeight: 20,
    },
    nearbyCard: {
        backgroundColor: "#fafaf8",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#e6e6df",
        padding: 20,
        marginBottom: 18,
    },
    nearbyTitle: {
        fontSize: 24,
        fontWeight: "800",
        color: "#111",
        marginBottom: 8,
    },
    nearbyBody: {
        fontSize: 15,
        color: "#5d6573",
        lineHeight: 22,
        marginBottom: 18,
    },
    primaryButton: {
        backgroundColor: "#1e3a5f",
        borderRadius: 16,
        paddingVertical: 15,
        alignItems: "center",
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    inlineError: {
        color: "#a4442d",
        fontSize: 13,
        lineHeight: 18,
        marginTop: 12,
    },
    emptyStateCard: {
        backgroundColor: "#fff3f0",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#f0c2b5",
        padding: 18,
        gap: 10,
    },
    emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        gap: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: "#111",
    },
    emptyBody: {
        fontSize: 14,
        color: "#6b7280",
        lineHeight: 20,
    },
    secondaryButton: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#d7dde6",
        borderRadius: 14,
        paddingVertical: 13,
        paddingHorizontal: 18,
        alignItems: "center",
        alignSelf: "flex-start",
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1e3a5f",
    },
    buttonDisabled: {
        opacity: 0.55,
    },
});
