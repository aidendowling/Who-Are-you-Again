import { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../config/firebase";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
} from "react-native-reanimated";

const TEST_USER_ID = "test-user-001";

interface StudentInfo {
    id: string;
    name: string;
    emoji: string;
    avatarType: string;
    avatarUri: string | null;
    major: string;
    year: string;
    interests: string;
    seat: string;
    handRaised: boolean;
}

export default function ClassroomScreen() {
    const router = useRouter();
    const { roomId, seat } = useLocalSearchParams<{ roomId: string; seat: string }>();
    const [profile, setProfile] = useState<any>(null);
    const [handRaised, setHandRaised] = useState(false);
    const [students, setStudents] = useState<StudentInfo[]>([]);

    useEffect(() => {
        loadProfile();
        checkInToRoom();
    }, []);

    // Listen for other students in the room
    useEffect(() => {
        if (!roomId) return;

        try {
            const roomRef = collection(db, "rooms", roomId, "checkins");
            const unsubscribe = onSnapshot(roomRef, (snapshot) => {
                const studentList: StudentInfo[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    studentList.push({
                        id: doc.id,
                        name: data.name || "Anonymous",
                        emoji: data.emoji || "😊",
                        avatarType: data.avatarType || "emoji",
                        avatarUri: data.avatarUri || null,
                        major: data.major || "",
                        year: data.year || "",
                        interests: data.interests || "",
                        seat: data.seat || "?",
                        handRaised: data.handRaised || false,
                    });
                });
                setStudents(studentList);
            });

            return () => unsubscribe();
        } catch (e) {
            console.log("Could not listen to room:", e);
        }
    }, [roomId]);

    const loadProfile = async () => {
        try {
            const docSnap = await getDoc(doc(db, "users", TEST_USER_ID));
            if (docSnap.exists()) {
                setProfile(docSnap.data());
            } else {
                setProfile({ name: "Student", emoji: "😊", major: "", year: "" });
            }
        } catch (e) {
            setProfile({ name: "Student", emoji: "😊", major: "", year: "" });
        }
    };

    const checkInToRoom = async () => {
        if (!roomId || !seat) return;
        try {
            const profileSnap = await getDoc(doc(db, "users", TEST_USER_ID));
            const profileData = profileSnap.exists() ? profileSnap.data() : {};

            await setDoc(doc(db, "rooms", roomId, "checkins", TEST_USER_ID), {
                name: profileData.name || "Student",
                emoji: profileData.emoji || "😊",
                avatarType: profileData.avatarType || "emoji",
                avatarUri: profileData.avatarUri || null,
                major: profileData.major || "",
                year: profileData.year || "",
                interests: profileData.interests || "",
                seat: seat,
                handRaised: false,
                checkedInAt: new Date().toISOString(),
            });
        } catch (e) {
            console.log("Could not check in:", e);
        }
    };

    const toggleHandRaise = async () => {
        const newState = !handRaised;
        setHandRaised(newState);

        if (!roomId) return;
        try {
            await setDoc(
                doc(db, "rooms", roomId, "checkins", TEST_USER_ID),
                { handRaised: newState },
                { merge: true }
            );
        } catch (e) {
            console.log("Could not update hand raise:", e);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.roomTitle}>
                                {roomId === "test-room" ? "Test Classroom" : `Room ${roomId}`}
                            </Text>
                            <Text style={styles.seatLabel}>
                                Seat {seat || "—"}
                            </Text>
                        </View>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => router.dismissAll()}
                            style={styles.leaveButton}
                        >
                            <Text style={styles.leaveText}>Leave</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Your Profile Card */}
                {profile && (
                    <View style={styles.profileCard}>
                        <Text style={styles.sectionLabel}>YOU</Text>
                        <View style={styles.profileRow}>
                            {profile.avatarType === "photo" && profile.avatarUri ? (
                                <Image source={{ uri: profile.avatarUri }} style={styles.profilePhoto} />
                            ) : (
                                <Text style={styles.profileEmoji}>{profile.emoji}</Text>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.profileName}>{profile.name}</Text>
                                {profile.major ? (
                                    <Text style={styles.profileDetail}>
                                        {profile.major}{profile.year ? ` • ${profile.year}` : ""}
                                    </Text>
                                ) : null}
                            </View>
                            <View style={[styles.seatBadge, handRaised && styles.seatBadgeActive]}>
                                <Text style={[styles.seatBadgeText, handRaised && styles.seatBadgeTextActive]}>
                                    {seat || "—"}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Raise Hand Button */}
                <RaiseHandButton raised={handRaised} onPress={toggleHandRaise} />

                {/* Status */}
                {handRaised && (
                    <View style={styles.statusBar}>
                        <Text style={styles.statusText}>✋ Hand raised — the professor can see you!</Text>
                    </View>
                )}

                {/* Classmates */}
                <View style={styles.classmatesSection}>
                    <Text style={styles.sectionLabel}>
                        IN THIS ROOM ({students.length})
                    </Text>

                    {students.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>👀</Text>
                            <Text style={styles.emptyText}>
                                No one else has joined yet.{"\n"}Share the QR code!
                            </Text>
                        </View>
                    ) : (
                        students.map((student) => (
                            <View key={student.id} style={styles.studentCard}>
                                {student.avatarType === "photo" && student.avatarUri ? (
                                    <Image source={{ uri: student.avatarUri }} style={styles.studentPhoto} />
                                ) : (
                                    <Text style={styles.studentEmoji}>{student.emoji}</Text>
                                )}
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                        <Text style={styles.studentName}>{student.name}</Text>
                                        {student.handRaised && (
                                            <Text style={{ fontSize: 14 }}>✋</Text>
                                        )}
                                    </View>
                                    {student.major ? (
                                        <Text style={styles.studentDetail}>
                                            {student.major}{student.year ? ` • ${student.year}` : ""}
                                        </Text>
                                    ) : null}
                                    {student.interests ? (
                                        <Text style={styles.studentInterests}>{student.interests}</Text>
                                    ) : null}
                                </View>
                                <View style={styles.studentSeat}>
                                    <Text style={styles.studentSeatText}>{student.seat}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function RaiseHandButton({ raised, onPress }: { raised: boolean; onPress: () => void }) {
    const wobble = useSharedValue(0);

    useEffect(() => {
        if (raised) {
            wobble.value = withRepeat(
                withSequence(
                    withTiming(-5, { duration: 100, easing: Easing.ease }),
                    withTiming(5, { duration: 200, easing: Easing.ease }),
                    withTiming(0, { duration: 100, easing: Easing.ease })
                ),
                3,
                false
            );
        } else {
            wobble.value = 0;
        }
    }, [raised]);

    const wobbleStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${wobble.value}deg` }],
    }));

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[
                styles.handButton,
                raised && styles.handButtonActive,
            ]}
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
        marginBottom: 24,
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    roomTitle: {
        fontSize: 28,
        fontWeight: "900",
        color: "#000",
    },
    seatLabel: {
        fontSize: 15,
        color: "#666",
        marginTop: 4,
    },
    leaveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    leaveText: {
        fontSize: 14,
        color: "#999",
        fontWeight: "500",
    },
    profileCard: {
        backgroundColor: "#fafafa",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#eee",
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#bbb",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    profileRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    profileEmoji: {
        fontSize: 36,
    },
    profilePhoto: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    profileName: {
        fontSize: 18,
        fontWeight: "700",
        color: "#000",
    },
    profileDetail: {
        fontSize: 14,
        color: "#666",
        marginTop: 2,
    },
    seatBadge: {
        backgroundColor: "#f0f0f0",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    seatBadgeActive: {
        backgroundColor: "#000",
    },
    seatBadgeText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#333",
    },
    seatBadgeTextActive: {
        color: "#fff",
    },
    handButton: {
        backgroundColor: "#f5f5f5",
        borderRadius: 16,
        paddingVertical: 20,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: "#eee",
    },
    handButtonActive: {
        backgroundColor: "#000",
        borderColor: "#000",
    },
    handButtonInner: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
    },
    handEmoji: {
        fontSize: 28,
    },
    handText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
    },
    handTextActive: {
        color: "#fff",
    },
    statusBar: {
        backgroundColor: "#fffbe6",
        borderRadius: 12,
        padding: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "#ffeeba",
    },
    statusText: {
        fontSize: 14,
        color: "#856404",
        textAlign: "center",
        fontWeight: "500",
    },
    classmatesSection: {
        marginTop: 8,
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: 40,
    },
    emptyEmoji: {
        fontSize: 40,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 15,
        color: "#999",
        textAlign: "center",
        lineHeight: 22,
    },
    studentCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "#fafafa",
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#f0f0f0",
    },
    studentEmoji: {
        fontSize: 28,
    },
    studentPhoto: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    studentName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
    },
    studentDetail: {
        fontSize: 13,
        color: "#666",
        marginTop: 2,
    },
    studentInterests: {
        fontSize: 12,
        color: "#999",
        marginTop: 2,
    },
    studentSeat: {
        backgroundColor: "#f0f0f0",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    studentSeatText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#666",
    },
});
