import { useEffect, useState } from "react";
import {
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";

const NAVY  = "#1e3a5f";
const serif = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const mono  = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

interface StudentProfile {
    name: string;
    emoji: string;
    avatarType: string;
    avatarUri: string | null;
    major: string;
    year: string;
    interests: string;
    funFact: string;
}

interface Props {
    /** UID of the student to display. Pass null/undefined to hide. */
    studentUid: string | null;
    /** Seat label shown in the sheet header (e.g. "3B"). Optional. */
    seatLabel?: string;
    onClose: () => void;
}

export function StudentProfileSheet({ studentUid, seatLabel, onClose }: Props) {
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!studentUid) {
            setProfile(null);
            return;
        }
        setLoading(true);
        getDoc(doc(db, "users", studentUid))
            .then((snap) => {
                if (snap.exists()) {
                    const d = snap.data();
                    setProfile({
                        name:      d.name      || "Student",
                        emoji:     d.emoji     || "😊",
                        avatarType: d.avatarType || "emoji",
                        avatarUri: d.avatarUri || null,
                        major:     d.major     || "",
                        year:      d.year      || "",
                        interests: d.interests || "",
                        funFact:   d.funFact   || "",
                    });
                } else {
                    setProfile(null);
                }
            })
            .catch((e) => {
                console.log("Could not load student profile:", e);
                setProfile(null);
            })
            .finally(() => setLoading(false));
    }, [studentUid]);

    return (
        <Modal
            visible={!!studentUid}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <Pressable style={st.backdrop} onPress={onClose} />
            <View style={st.sheet}>
                <View style={st.handle} />

                {/* Top bar */}
                <View style={st.topBar}>
                    <Text style={st.topBarTitle}>
                        {seatLabel ? `Seat ${seatLabel}` : "Student"}
                    </Text>
                    <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
                        <Text style={st.doneBtn}>Done</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={st.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View style={st.centerBody}>
                            <Text style={st.emptyTitle}>Loading…</Text>
                        </View>
                    ) : !profile ? (
                        <View style={st.centerBody}>
                            <Text style={st.emptyTitle}>Profile unavailable</Text>
                            <Text style={st.emptyBody}>
                                This student hasn't filled out their profile yet.
                            </Text>
                        </View>
                    ) : (
                        <>
                            {/* Avatar */}
                            <View style={st.avatarWrap}>
                                {profile.avatarType === "photo" && profile.avatarUri ? (
                                    <Image
                                        source={{ uri: profile.avatarUri }}
                                        style={st.avatarImage}
                                    />
                                ) : (
                                    <View style={st.avatarBg}>
                                        <Text style={st.avatarEmoji}>{profile.emoji}</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={st.name}>{profile.name}</Text>

                            {(profile.year || profile.major) ? (
                                <Text style={st.subtitle}>
                                    {[profile.year, profile.major].filter(Boolean).join(" · ")}
                                </Text>
                            ) : null}

                            {profile.interests ? (
                                <View style={st.infoCard}>
                                    <Text style={st.infoLabel}>Interests</Text>
                                    <Text style={st.infoBody}>{profile.interests}</Text>
                                </View>
                            ) : null}

                            {profile.funFact ? (
                                <View style={st.infoCard}>
                                    <Text style={st.infoLabel}>Fun Fact</Text>
                                    <Text style={st.infoBody}>{profile.funFact}</Text>
                                </View>
                            ) : null}

                            {!profile.interests && !profile.funFact ? (
                                <View style={st.infoCard}>
                                    <Text style={st.emptyBody}>
                                        This student hasn't shared any additional details.
                                    </Text>
                                </View>
                            ) : null}
                        </>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const st = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(11,18,32,0.52)",
    },
    sheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fafaf8",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: "82%",
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
    doneBtn: {
        fontSize: 16,
        fontWeight: "700",
        color: NAVY,
        fontFamily: mono,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 48,
        alignItems: "center",
        gap: 12,
    },
    centerBody: {
        paddingVertical: 48,
        alignItems: "center",
        gap: 8,
    },
    avatarWrap: {
        marginBottom: 8,
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
    },
    subtitle: {
        fontSize: 15,
        fontFamily: mono,
        color: "#5f6876",
        textAlign: "center",
        marginBottom: 4,
    },
    infoCard: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e4e7ed",
        padding: 16,
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
    emptyTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#111",
        fontFamily: serif,
        textAlign: "center",
    },
    emptyBody: {
        fontSize: 14,
        color: "#6b7280",
        lineHeight: 20,
        fontFamily: mono,
        textAlign: "center",
    },
});
