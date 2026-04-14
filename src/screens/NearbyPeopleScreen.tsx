import { useEffect, useRef, useState } from "react";
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { useSharedValue, withTiming } from "react-native-reanimated";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { NearbyGrid } from "../components/nearby/NearbyGrid";
import { ExpandedProfileOverlay } from "../components/nearby/ExpandedProfileOverlay";
import {
    fetchNearbySeats,
    fetchNearbyStudentProfile,
    NearbySeatCard,
    NearbySeatsResponse,
    NearbyStudentProfile,
} from "../lib/proximityApi";
import { ensureAnonymousUid } from "../utils/auth";

interface CardLayout {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface SelfPreview {
    firstName: string;
    year: string;
    major: string;
    avatarType: string;
    avatarUri: string | null;
    emoji: string;
}

export default function NearbyPeopleScreen() {
    const router = useRouter();
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const rootRef = useRef<View | null>(null);
    const seatRefs = useRef<Record<string, View | null>>({});

    const [nearby, setNearby] = useState<NearbySeatsResponse | null>(null);
    const [selfPreview, setSelfPreview] = useState<SelfPreview | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSeat, setSelectedSeat] = useState<NearbySeatCard | null>(null);
    const [selectedProfile, setSelectedProfile] = useState<NearbyStudentProfile | null>(null);
    const [selectedCardLayout, setSelectedCardLayout] = useState<CardLayout | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [isProfileUnavailable, setIsProfileUnavailable] = useState(false);

    const overlayProgress = useSharedValue(0);

    useEffect(() => {
        let isMounted = true;

        const loadSelfPreview = async () => {
            try {
                const uid = await ensureAnonymousUid();
                const userSnap = await getDoc(doc(db, "users", uid));
                if (!userSnap.exists() || !isMounted) return;

                const data = userSnap.data();
                setSelfPreview({
                    firstName: String(data.name || "You").trim().split(/\s+/)[0] || "You",
                    year: data.year || "",
                    major: data.major || "",
                    avatarType: data.avatarType || "emoji",
                    avatarUri: data.avatarUri || null,
                    emoji: data.emoji || "😊",
                });
            } catch (loadError) {
                console.log("Could not load self preview:", loadError);
            }
        };

        loadSelfPreview();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!roomId) {
            setError("Missing roomId.");
            setIsLoading(false);
            return;
        }

        void loadNearby();
    }, [roomId]);

    const loadNearby = async () => {
        if (!roomId) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetchNearbySeats(roomId);
            setNearby(response);

            if (selectedSeat) {
                const refreshedSeat = response.seats.find((seat) => seat.seatId === selectedSeat.seatId);
                if (!refreshedSeat || refreshedSeat.status !== "occupied" || refreshedSeat.uid !== selectedSeat.uid) {
                    setIsProfileUnavailable(true);
                }
            }
        } catch (loadError) {
            console.log("Could not load nearby seats:", loadError);
            setError("Could not load nearby seats. Make sure your seat check-in is active and the room manifest exists.");
        } finally {
            setIsLoading(false);
        }
    };

    const measureSeatCard = async (seatId: string) => {
        const root = rootRef.current;
        const seatNode = seatRefs.current[seatId];

        if (!root || !seatNode) {
            return null;
        }

        const measureWindow = (node: View) =>
            new Promise<CardLayout>((resolve) => {
                node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
            });

        const [rootBounds, seatBounds] = await Promise.all([measureWindow(root), measureWindow(seatNode)]);

        return {
            x: seatBounds.x - rootBounds.x,
            y: seatBounds.y - rootBounds.y,
            width: seatBounds.width,
            height: seatBounds.height,
        };
    };

    const closeOverlay = () => {
        overlayProgress.value = withTiming(0, { duration: 180 });
        setTimeout(() => {
            setSelectedSeat(null);
            setSelectedProfile(null);
            setSelectedCardLayout(null);
            setIsProfileUnavailable(false);
        }, 190);
    };

    const handleSeatPress = async (seat: NearbySeatCard) => {
        if (!roomId || seat.status !== "occupied" || !seat.uid) {
            return;
        }

        const layout = await measureSeatCard(seat.seatId);
        if (!layout) return;

        setSelectedSeat(seat);
        setSelectedCardLayout(layout);
        setSelectedProfile(null);
        setIsProfileLoading(true);
        setIsProfileUnavailable(false);
        overlayProgress.value = 0;
        overlayProgress.value = withTiming(1, { duration: 220 });

        try {
            const profile = await fetchNearbyStudentProfile(roomId, seat.uid);
            setSelectedProfile(profile);
        } catch (profileError) {
            console.log("Could not load nearby student profile:", profileError);
            setIsProfileUnavailable(true);
        } finally {
            setIsProfileLoading(false);
        }
    };

    return (
        <View ref={rootRef} style={styles.container} collapsable={false}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={loadNearby} tintColor="#1e3a5f" />
                }
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backButton}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>People Nearby</Text>
                    <Text style={styles.subtitle}>
                        You are always centered. Empty physical seats stay visible. Missing seats do not.
                    </Text>
                </View>

                {error ? (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorTitle}>Nearby grid unavailable</Text>
                        <Text style={styles.errorBody}>{error}</Text>
                    </View>
                ) : isLoading && !nearby ? (
                    <View style={styles.loadingCard}>
                        <Text style={styles.loadingTitle}>Loading nearby seats…</Text>
                        <Text style={styles.loadingBody}>Pull to refresh if the layout or occupancy changed.</Text>
                    </View>
                ) : nearby ? (
                    <>
                        <View style={styles.podium}>
                            <Text style={styles.podiumText}>Front of Room</Text>
                        </View>
                        <NearbyGrid
                            nearby={nearby}
                            seatRefs={seatRefs}
                            selfPreview={selfPreview}
                            selectedSeatId={selectedSeat?.seatId}
                            onSeatPress={handleSeatPress}
                        />
                    </>
                ) : null}
            </ScrollView>

            <ExpandedProfileOverlay
                visible={!!selectedSeat}
                progress={overlayProgress}
                origin={selectedCardLayout}
                seatLabel={selectedSeat?.label}
                profile={selectedProfile}
                isLoading={isProfileLoading}
                isUnavailable={isProfileUnavailable}
                onClose={closeOverlay}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f6f4ef",
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 56,
        paddingBottom: 40,
        gap: 18,
    },
    header: {
        alignItems: "center",
        gap: 10,
        marginBottom: 8,
    },
    backButton: {
        alignSelf: "flex-start",
        paddingVertical: 8,
    },
    backText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1e3a5f",
    },
    title: {
        fontSize: 32,
        fontWeight: "900",
        color: "#111",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 21,
        color: "#5f6876",
        textAlign: "center",
        maxWidth: 320,
    },
    podium: {
        alignSelf: "center",
        backgroundColor: "#fff",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#dfe4eb",
        paddingHorizontal: 18,
        paddingVertical: 8,
        marginBottom: 8,
    },
    podiumText: {
        color: "#728092",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1.1,
    },
    loadingCard: {
        backgroundColor: "#fff",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        padding: 22,
        alignItems: "center",
        gap: 8,
    },
    loadingTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: "#111",
    },
    loadingBody: {
        fontSize: 14,
        color: "#6b7280",
        textAlign: "center",
        lineHeight: 20,
    },
    errorCard: {
        backgroundColor: "#fff4ef",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "#f0c7ba",
        padding: 20,
        gap: 8,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: "#7d2d13",
    },
    errorBody: {
        fontSize: 14,
        lineHeight: 20,
        color: "#8e452d",
    },
});
