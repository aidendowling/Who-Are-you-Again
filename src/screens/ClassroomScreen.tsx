import { useEffect, useState } from "react";
import {
    Image,
    Linking,
    Modal,
    Platform,
    Pressable,
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

const NAVY = "#1e3a5f";
const serif = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const mono  = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

interface ProfileData {
    name: string;
    emoji: string;
    avatarType: string;
    avatarUri: string | null;
    major: string;
    year: string;
}

interface ProfessorProfileData {
    name: string;
    title: string;
    department: string;
    bio: string;
    officeHours: string;
    researchInterests: string;
    email: string;
    website: string;
    availability: string;
    emoji: string;
    avatarType: string;
    avatarUri: string | null;
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
    const [professor, setProfessor] = useState<ProfessorProfileData | null>(null);
    const [professorModalVisible, setProfessorModalVisible] = useState(false);
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

        let lastProfessorUid: string | null = null;
        const unsubscribeRoom = onSnapshot(roomRef, async (snapshot) => {
            if (!snapshot.exists()) return;

            const data = snapshot.data();
            setRoomMeta({
                layoutName: data.layoutName || data.layout?.name,
                seatCount: data.seatCount,
            });

            const profUid: string | undefined = data.professorUid;
            if (profUid && profUid !== lastProfessorUid) {
                lastProfessorUid = profUid;
                try {
                    const profSnap = await getDoc(doc(db, "users", profUid));
                    if (profSnap.exists()) {
                        const d = profSnap.data();
                        setProfessor({
                            name: d.name || "",
                            title: d.title || "",
                            department: d.department || "",
                            bio: d.bio || "",
                            officeHours: d.officeHours || "",
                            researchInterests: d.researchInterests || "",
                            email: d.email || "",
                            website: d.website || "",
                            availability: d.availability || "",
                            emoji: d.emoji || "🧑‍🏫",
                            avatarType: d.avatarType || "emoji",
                            avatarUri: d.avatarUri || null,
                        });
                    }
                } catch (e) {
                    console.log("Could not load professor profile:", e);
                }
            }
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

                {professor && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setProfessorModalVisible(true)}
                        style={styles.professorCard}
                    >
                        <Text style={styles.sectionLabel}>Instructor</Text>
                        <View style={styles.profileRow}>
                            {professor.avatarType === "photo" && professor.avatarUri ? (
                                <Image source={{ uri: professor.avatarUri }} style={styles.profilePhoto} />
                            ) : (
                                <Text style={styles.profileEmoji}>{professor.emoji}</Text>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.profileName}>{professor.name}</Text>
                                {(professor.title || professor.department) ? (
                                    <Text style={styles.profileDetail}>
                                        {[professor.title, professor.department].filter(Boolean).join(" · ")}
                                    </Text>
                                ) : null}
                                {professor.researchInterests ? (
                                    <Text style={styles.professorInterests} numberOfLines={1}>
                                        {professor.researchInterests}
                                    </Text>
                                ) : null}
                            </View>
                            <Text style={styles.professorChevron}>›</Text>
                        </View>
                        {professor.officeHours ? (
                            <View style={styles.officeHoursRow}>
                                <Text style={styles.officeHoursLabel}>Office hours  </Text>
                                <Text style={styles.officeHoursValue}>{professor.officeHours}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                )}

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
            {professor && (
                <Modal
                    visible={professorModalVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={() => setProfessorModalVisible(false)}
                >
                    <Pressable
                        style={profSheet.backdrop}
                        onPress={() => setProfessorModalVisible(false)}
                    />
                    <View style={profSheet.sheet}>
                        <View style={profSheet.handle} />
                        <View style={profSheet.topBar}>
                            <Text style={profSheet.topBarTitle}>Instructor</Text>
                            <TouchableOpacity onPress={() => setProfessorModalVisible(false)} hitSlop={12}>
                                <Text style={profSheet.closeBtn}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            contentContainerStyle={profSheet.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Avatar */}
                            <View style={profSheet.avatarWrap}>
                                {professor.avatarType === "photo" && professor.avatarUri ? (
                                    <Image source={{ uri: professor.avatarUri }} style={profSheet.avatarImage} />
                                ) : (
                                    <View style={profSheet.avatarBg}>
                                        <Text style={profSheet.avatarEmoji}>{professor.emoji}</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={profSheet.name}>{professor.name}</Text>
                            {(professor.title || professor.department) ? (
                                <Text style={profSheet.titleDept}>
                                    {[professor.title, professor.department].filter(Boolean).join(" · ")}
                                </Text>
                            ) : null}

                            {/* Info sections */}
                            {professor.bio ? (
                                <View style={profSheet.infoCard}>
                                    <Text style={profSheet.infoLabel}>About</Text>
                                    <Text style={profSheet.infoBody}>{professor.bio}</Text>
                                </View>
                            ) : null}

                            {professor.officeHours ? (
                                <View style={profSheet.infoCard}>
                                    <Text style={profSheet.infoLabel}>Office Hours</Text>
                                    <Text style={profSheet.infoBody}>{professor.officeHours}</Text>
                                </View>
                            ) : null}

                            {professor.researchInterests ? (
                                <View style={profSheet.infoCard}>
                                    <Text style={profSheet.infoLabel}>Research / Teaching Interests</Text>
                                    <Text style={profSheet.infoBody}>{professor.researchInterests}</Text>
                                </View>
                            ) : null}

                            {/* Link chips */}
                            {(professor.email || professor.website || professor.availability) ? (
                                <View style={profSheet.linksSection}>
                                    <Text style={profSheet.infoLabel}>Links</Text>
                                    <View style={profSheet.linksRow}>
                                        {professor.email ? (
                                            <TouchableOpacity
                                                style={profSheet.chip}
                                                onPress={() => Linking.openURL(`mailto:${professor.email}`)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={profSheet.chipText}>✉ Email</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                        {professor.website ? (
                                            <TouchableOpacity
                                                style={profSheet.chip}
                                                onPress={() => Linking.openURL(professor.website)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={profSheet.chipText}>🌐 Website</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                        {professor.availability ? (
                                            <TouchableOpacity
                                                style={profSheet.chip}
                                                onPress={() => Linking.openURL(professor.availability)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={profSheet.chipText}>📅 Availability</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            ) : null}
                        </ScrollView>
                    </View>
                </Modal>
            )}
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

    // Professor card
    professorCard: {
        backgroundColor: "#f0f4fa",
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: "#d0daea",
        marginBottom: 16,
    },
    professorInterests: {
        fontSize: 12,
        color: "#7a8ca8",
        marginTop: 2,
    },
    professorChevron: {
        fontSize: 24,
        color: "#9aacc4",
        marginLeft: 4,
    },
    officeHoursRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#d0daea",
    },
    officeHoursLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#6d84a0",
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    officeHoursValue: {
        flex: 1,
        fontSize: 13,
        color: NAVY,
        fontWeight: "600",
    },
});

// ─── Professor profile sheet (read-only modal) ────────────────────────────────

const profSheet = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(11,18,32,0.5)",
    },
    sheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fafaf8",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: "88%",
        overflow: "hidden",
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#d4d7de",
        alignSelf: "center",
        marginTop: 10,
        marginBottom: 2,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#eaecf0",
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: "700",
        fontFamily: serif,
        color: "#111",
    },
    closeBtn: {
        fontSize: 16,
        fontWeight: "700",
        color: NAVY,
        fontFamily: mono,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 48,
        alignItems: "center",
    },
    avatarWrap: {
        marginBottom: 16,
    },
    avatarImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
    },
    avatarBg: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#e8edf6",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarEmoji: {
        fontSize: 46,
    },
    name: {
        fontSize: 28,
        fontWeight: "900",
        fontFamily: serif,
        color: "#111",
        textAlign: "center",
        marginBottom: 6,
    },
    titleDept: {
        fontSize: 15,
        color: "#5f6876",
        fontFamily: mono,
        textAlign: "center",
        marginBottom: 24,
    },
    infoCard: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e4e7ed",
        padding: 16,
        marginBottom: 12,
        gap: 6,
    },
    infoLabel: {
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: "#8b93a2",
        fontWeight: "700",
        fontFamily: mono,
    },
    infoBody: {
        fontSize: 15,
        color: "#1f2937",
        lineHeight: 22,
        fontFamily: serif,
    },
    linksSection: {
        width: "100%",
        marginTop: 4,
        gap: 12,
    },
    linksRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 8,
    },
    chip: {
        backgroundColor: NAVY,
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 10,
    },
    chipText: {
        fontSize: 14,
        fontFamily: mono,
        fontWeight: "600",
        color: "#fff",
    },
});
