import { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Platform,
    Modal,
    TextInput,
    Image,
    KeyboardAvoidingView,
    Alert,
    Dimensions,
    Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../config/firebase";
import { doc, collection, onSnapshot, writeBatch, getDoc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { ensureAnonymousUid } from "../utils/auth";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

const serifFont = Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
});

const monoFont = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
});

interface CheckIn {
    id: string;
    name: string;
    seat: string;
    handRaised: boolean;
    checkedInAt: string;
}

interface NotificationItem {
    id: string;
    type: "handRaise" | "checkIn";
    name: string;
    seat: string;
    timestamp: string;
    isRead: boolean;
}

interface ProfessorProfile {
    name: string;
    bio: string;
    email: string;
    website: string;
    availability: string;
    avatarType: string;
    avatarUri: string | null;
    emoji: string;
}

function timeAgo(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} days ago`;
}

// ─── Profile Sheet ────────────────────────────────────────────────────────────

const PINK = "#e91e8c";
const PINK_BG = "#fdf0f7";

function ProfessorProfileSheet({
    visible,
    onClose,
}: {
    visible: boolean;
    onClose: () => void;
}) {
    const [profile, setProfile] = useState<ProfessorProfile | null>(null);
    const [nameText, setNameText] = useState("");
    const [bioText, setBioText] = useState("");
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [avatarType, setAvatarType] = useState<string>("emoji");
    const [uid, setUid] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Track whether anything changed so Save is only active when needed
    const isDirty =
        profile !== null &&
        (nameText !== profile.name ||
            bioText !== profile.bio ||
            avatarUri !== profile.avatarUri);

    useEffect(() => {
        if (!visible) return;
        loadProfile();
    }, [visible]);

    const loadProfile = async () => {
        try {
            const resolvedUid = await ensureAnonymousUid();
            setUid(resolvedUid);
            const snap = await getDoc(doc(db, "users", resolvedUid));
            if (snap.exists()) {
                const d = snap.data();
                const loaded: ProfessorProfile = {
                    name: d.name || "",
                    bio: d.bio || "",
                    email: d.email || "",
                    website: d.website || "",
                    availability: d.availability || "",
                    avatarType: d.avatarType || "emoji",
                    avatarUri: d.avatarUri || null,
                    emoji: d.emoji || "🧑‍🏫",
                };
                setProfile(loaded);
                setNameText(loaded.name);
                setBioText(loaded.bio);
                setAvatarUri(loaded.avatarUri);
                setAvatarType(loaded.avatarType);
            }
        } catch (e) {
            console.log("Could not load professor profile:", e);
        }
    };

    const pickPhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "Please allow access to your photo library.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });
        if (!result.canceled && result.assets[0]) {
            const manipulated = await manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 200, height: 200 } }],
                { compress: 0.5, format: SaveFormat.JPEG, base64: true }
            );
            if (manipulated.base64) {
                setAvatarUri(`data:image/jpeg;base64,${manipulated.base64}`);
                setAvatarType("photo");
            }
        }
    };

    const saveAll = async () => {
        if (!uid || !profile) return;
        setSaving(true);
        try {
            await setDoc(
                doc(db, "users", uid),
                {
                    name: nameText.trim() || profile.name,
                    bio: bioText,
                    avatarType,
                    avatarUri: avatarType === "photo" ? avatarUri : null,
                },
                { merge: true }
            );
            setProfile((p) =>
                p
                    ? {
                          ...p,
                          name: nameText.trim() || p.name,
                          bio: bioText,
                          avatarType,
                          avatarUri: avatarType === "photo" ? avatarUri : null,
                      }
                    : p
            );
            onClose();
        } catch (e) {
            console.log("Could not save profile:", e);
        }
        setSaving(false);
    };

    const SHEET_HEIGHT = Dimensions.get("window").height * 0.75;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={sheet.modalRoot}
            >
                {/* Backdrop — tap to dismiss */}
                <Pressable style={sheet.backdrop} onPress={onClose} />

                {/* The 75% sheet */}
                <View style={[sheet.sheetPanel, { height: SHEET_HEIGHT }]}>
                    {/* Drag handle */}
                    <View style={sheet.handle} />

                    {/* Top bar */}
                    <View style={sheet.topBar}>
                        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={sheet.topBarBtn}>
                            <Text style={sheet.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={sheet.topBarTitle}>Professor Profile</Text>
                        <TouchableOpacity
                            onPress={saveAll}
                            activeOpacity={0.7}
                            style={sheet.topBarBtn}
                            disabled={!isDirty || saving}
                        >
                            <Text style={[sheet.saveText, (!isDirty || saving) && sheet.saveTextDisabled]}>
                                {saving ? "Saving…" : "Save"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={sheet.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Tappable avatar with camera overlay */}
                        <TouchableOpacity
                            onPress={pickPhoto}
                            activeOpacity={0.8}
                            style={sheet.avatarWrap}
                        >
                            {avatarType === "photo" && avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={sheet.avatarImage} />
                            ) : (
                                <View style={sheet.avatarEmojiBg}>
                                    <Text style={sheet.avatarEmoji}>
                                        {profile?.emoji ?? "🧑‍🏫"}
                                    </Text>
                                </View>
                            )}
                            {/* Camera overlay */}
                            <View style={sheet.cameraOverlay}>
                                <Text style={sheet.cameraIcon}>📷</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Editable name — tap directly on the text */}
                        <TextInput
                            style={sheet.nameInput}
                            value={nameText}
                            onChangeText={setNameText}
                            placeholder="Your name"
                            placeholderTextColor="#ccc"
                            textAlign="center"
                            returnKeyType="done"
                        />
                        <Text style={sheet.nameHint}>tap to edit name</Text>

                        {/* About me — whole box is the input */}
                        <View style={sheet.bioBox}>
                            <Text style={sheet.bioLabel}>About me</Text>
                            <TextInput
                                style={sheet.bioInput}
                                value={bioText}
                                onChangeText={setBioText}
                                multiline
                                placeholder="Tell students about yourself..."
                                placeholderTextColor="#f09ed8"
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Links */}
                        <View style={sheet.linksSection}>
                            <Text style={sheet.linksLabel}>Links</Text>
                            <View style={sheet.pillsRow}>
                                <View style={sheet.pill}>
                                    <Text style={sheet.pillText}>email</Text>
                                </View>
                                <View style={sheet.pill}>
                                    <Text style={sheet.pillText}>website</Text>
                                </View>
                                <View style={sheet.pill}>
                                    <Text style={sheet.pillText}>availability</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfessorDashboardScreen() {
    const router = useRouter();
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const [checkins, setCheckins] = useState<CheckIn[]>([]);
    const [profileSheetVisible, setProfileSheetVisible] = useState(false);

    useEffect(() => {
        if (!roomId) return;

        const roomRef = collection(db, "rooms", roomId, "checkins");
        const unsubscribe = onSnapshot(roomRef, (snapshot) => {
            const list: CheckIn[] = [];
            snapshot.forEach((d) => {
                const data = d.data();
                if (data.userType === "student" || !data.userType) {
                    list.push({
                        id: d.id,
                        name: data.name || "Anonymous",
                        seat: data.seat || "?",
                        handRaised: data.handRaised || false,
                        checkedInAt: data.checkedInAt || new Date().toISOString(),
                    });
                }
            });
            setCheckins(list);
        });

        return () => unsubscribe();
    }, [roomId]);

    const notifications: NotificationItem[] = [
        ...checkins
            .filter((c) => c.handRaised)
            .map((c) => ({
                id: `raise-${c.id}`,
                type: "handRaise" as const,
                name: c.name,
                seat: c.seat,
                timestamp: c.checkedInAt,
                isRead: false,
            })),
        ...checkins
            .map((c) => ({
                id: `checkin-${c.id}`,
                type: "checkIn" as const,
                name: c.name,
                seat: c.seat,
                timestamp: c.checkedInAt,
                isRead: true,
            }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    ];

    const unreadCount = checkins.filter((c) => c.handRaised).length;

    const markAllRead = async () => {
        if (!roomId) return;
        const batch = writeBatch(db);
        checkins
            .filter((c) => c.handRaised)
            .forEach((c) => {
                batch.update(doc(db, "rooms", roomId, "checkins", c.id), {
                    handRaised: false,
                });
            });
        try {
            await batch.commit();
        } catch (e) {
            console.log("Could not mark all read:", e);
        }
    };

    const endSession = () => {
        Alert.alert(
            "End Session",
            "This will clear all check-ins and seat assignments for this room. Students will need to re-scan to rejoin.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "End Session",
                    style: "destructive",
                    onPress: async () => {
                        if (!roomId) return;
                        try {
                            const snap = await getDocs(
                                collection(db, "rooms", roomId, "checkins")
                            );
                            const batch = writeBatch(db);
                            snap.forEach((d) =>
                                batch.delete(doc(db, "rooms", roomId, "checkins", d.id))
                            );
                            await batch.commit();
                        } catch (e) {
                            console.log("Could not end session:", e);
                        }
                        router.dismissAll();
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Dashboard</Text>

                {/* Seating Map */}
                <TouchableOpacity
                    style={styles.actionCard}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/seating-map?roomId=${roomId}` as any)}
                >
                    <View style={[styles.actionIconWrap, styles.mapIconWrap]}>
                        <Text style={styles.actionIconEmoji}>🗺️</Text>
                    </View>
                    <View style={styles.actionTextWrap}>
                        <Text style={styles.actionTitle}>Seating Map</Text>
                        <Text style={styles.actionSubtitle}>
                            View live classroom layout and seat assignments
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Edit Profile */}
                <TouchableOpacity
                    style={styles.actionCard}
                    activeOpacity={0.7}
                    onPress={() => setProfileSheetVisible(true)}
                >
                    <View style={[styles.actionIconWrap, styles.profileIconWrap]}>
                        <Text style={styles.actionIconEmoji}>👤</Text>
                    </View>
                    <View style={styles.actionTextWrap}>
                        <Text style={styles.actionTitle}>Edit Profile</Text>
                        <Text style={styles.actionSubtitle}>
                            Edit your professor information for students to view
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Notifications */}
                <View style={styles.notifCard}>
                    <View style={styles.notifHeader}>
                        <View style={styles.notifHeaderLeft}>
                            <Text style={styles.notifCardTitle}>Notifications</Text>
                            {unreadCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{unreadCount}</Text>
                                </View>
                            )}
                        </View>
                        {unreadCount > 0 && (
                            <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
                                <Text style={styles.markAllRead}>Mark all read ^</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {notifications.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No activity yet</Text>
                        </View>
                    ) : (
                        notifications.map((item, index) => (
                            <View
                                key={item.id}
                                style={[
                                    styles.notifItem,
                                    index < notifications.length - 1 && styles.notifItemBorder,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.notifIconWrap,
                                        item.type === "handRaise"
                                            ? styles.notifIconHand
                                            : styles.notifIconCheckin,
                                    ]}
                                >
                                    <Text style={styles.notifIconEmoji}>
                                        {item.type === "handRaise" ? "✋" : "👤"}
                                    </Text>
                                </View>
                                <View style={styles.notifBody}>
                                    <Text style={styles.notifText}>
                                        {item.type === "handRaise"
                                            ? `${item.name} raised their hand in seat ${item.seat}`
                                            : `${item.name} checked into seat ${item.seat}`}
                                    </Text>
                                    <Text style={styles.notifTime}>
                                        {timeAgo(item.timestamp)}
                                    </Text>
                                </View>
                                {!item.isRead && <View style={styles.unreadDot} />}
                            </View>
                        ))
                    )}
                </View>

                {/* End Session — clears all check-ins */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={endSession}
                    style={styles.endSessionButton}
                >
                    <Text style={styles.endSessionText}>End Session</Text>
                </TouchableOpacity>

                {/* Exit Room — leaves without clearing data */}
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                        Alert.alert(
                            "Exit Without Ending?",
                            "Check-ins will remain in the room. The seating map will show stale data until a new session is started.",
                            [
                                { text: "Cancel", style: "cancel" },
                                { text: "Exit Anyway", style: "destructive", onPress: () => router.dismissAll() },
                            ]
                        );
                    }}
                    style={styles.exitButton}
                >
                    <Text style={styles.exitText}>Exit (Keep Check-ins)</Text>
                </TouchableOpacity>
            </ScrollView>

            <ProfessorProfileSheet
                visible={profileSheetVisible}
                onClose={() => setProfileSheetVisible(false)}
            />
        </SafeAreaView>
    );
}

// ─── Dashboard styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 48,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        fontFamily: serifFont,
        color: "#000",
        marginBottom: 20,
        marginTop: 4,
    },
    actionCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e8e8e8",
        padding: 18,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    actionIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    mapIconWrap: {
        backgroundColor: "#e8f0fe",
    },
    profileIconWrap: {
        backgroundColor: "#e6f4ea",
    },
    actionIconEmoji: {
        fontSize: 22,
    },
    actionTextWrap: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: "700",
        fontFamily: serifFont,
        color: "#000",
        marginBottom: 3,
    },
    actionSubtitle: {
        fontSize: 13,
        fontFamily: monoFont,
        color: "#888",
        lineHeight: 18,
    },
    notifCard: {
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e8e8e8",
        marginBottom: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    notifHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    notifHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    notifCardTitle: {
        fontSize: 16,
        fontWeight: "700",
        fontFamily: serifFont,
        color: "#000",
    },
    badge: {
        backgroundColor: "#e53e3e",
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 5,
    },
    badgeText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
    },
    markAllRead: {
        fontSize: 13,
        fontFamily: monoFont,
        color: "#666",
    },
    notifItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fafafa",
    },
    notifItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    notifIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    notifIconHand: {
        backgroundColor: "#fff3e0",
    },
    notifIconCheckin: {
        backgroundColor: "#e6f4ea",
    },
    notifIconEmoji: {
        fontSize: 16,
    },
    notifBody: {
        flex: 1,
    },
    notifText: {
        fontSize: 14,
        fontWeight: "700",
        fontFamily: serifFont,
        color: "#000",
        marginBottom: 2,
    },
    notifTime: {
        fontSize: 12,
        fontFamily: monoFont,
        color: "#888",
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#3b82f6",
    },
    emptyState: {
        padding: 32,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 14,
        color: "#999",
        fontFamily: monoFont,
    },
    endSessionButton: {
        backgroundColor: "#c0392b",
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 10,
        shadowColor: "#c0392b",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    endSessionText: {
        fontSize: 16,
        fontFamily: monoFont,
        fontWeight: "700",
        color: "#fff",
    },
    exitButton: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },
    exitText: {
        fontSize: 14,
        color: "#aaa",
        fontFamily: monoFont,
        fontWeight: "500",
    },
});

// ─── Profile sheet styles ─────────────────────────────────────────────────────

const sheet = StyleSheet.create({
    // Full-screen transparent overlay
    modalRoot: {
        flex: 1,
        justifyContent: "flex-end",
    },
    // Tappable dark area above the sheet
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.45)",
    },
    // The sheet panel itself
    sheetPanel: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#ddd",
        alignSelf: "center",
        marginTop: 10,
        marginBottom: 2,
    },
    // Top navigation bar (Cancel | title | Save)
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    topBarBtn: {
        minWidth: 64,
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: "700",
        fontFamily: serifFont,
        color: "#111",
    },
    cancelText: {
        fontSize: 16,
        color: "#666",
        fontFamily: monoFont,
    },
    saveText: {
        fontSize: 16,
        color: PINK,
        fontWeight: "700",
        fontFamily: monoFont,
        textAlign: "right",
    },
    saveTextDisabled: {
        color: "#ccc",
    },
    scrollContent: {
        paddingHorizontal: 28,
        paddingTop: 20,
        paddingBottom: 40,
        alignItems: "center",
    },
    // Avatar
    avatarWrap: {
        marginBottom: 8,
        position: "relative",
    },
    avatarImage: {
        width: 110,
        height: 110,
        borderRadius: 55,
    },
    avatarEmojiBg: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: "#f0f0f0",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarEmoji: {
        fontSize: 52,
    },
    // Camera badge in bottom-right of avatar
    cameraOverlay: {
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: "#ddd",
        justifyContent: "center",
        alignItems: "center",
    },
    cameraIcon: {
        fontSize: 15,
    },
    // Name input — looks like a heading, but is editable
    nameInput: {
        fontSize: 20,
        fontWeight: "700",
        fontFamily: serifFont,
        color: "#111",
        textAlign: "center",
        width: "100%",
        paddingVertical: 6,
        borderBottomWidth: 1.5,
        borderBottomColor: "#eee",
        marginBottom: 4,
    },
    nameHint: {
        fontSize: 11,
        fontFamily: monoFont,
        color: "#bbb",
        textAlign: "center",
        marginBottom: 28,
    },
    // About me box — whole thing is the input
    bioBox: {
        width: "100%",
        backgroundColor: PINK_BG,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#f5c6e4",
        padding: 14,
        marginBottom: 24,
        minHeight: 110,
    },
    bioLabel: {
        fontSize: 12,
        fontFamily: monoFont,
        color: "#aaa",
        marginBottom: 8,
    },
    bioInput: {
        fontSize: 14,
        fontFamily: monoFont,
        color: PINK,
        lineHeight: 22,
        minHeight: 70,
        width: "100%",
    },
    // Links
    linksSection: {
        width: "100%",
    },
    linksLabel: {
        fontSize: 12,
        fontFamily: monoFont,
        color: "#aaa",
        marginBottom: 10,
    },
    pillsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    pill: {
        backgroundColor: PINK_BG,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#f5c6e4",
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
    pillText: {
        fontSize: 14,
        fontFamily: monoFont,
        color: PINK,
    },
});
