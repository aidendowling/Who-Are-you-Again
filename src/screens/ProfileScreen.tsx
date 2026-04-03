import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Image,
    Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { db } from "../config/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ensureAnonymousUid } from "../utils/auth";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

const EMOJI_OPTIONS = ["😊", "🤓", "😎", "🧑‍💻", "🎨", "🎵", "⚡", "🌟", "🦊", "🐱", "🌈", "🔥", "💡", "📚", "🎮", "🏀"];
const YEAR_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad Student"];
const TITLE_OPTIONS = ["Professor", "Assoc. Professor", "Asst. Professor", "Lecturer", "Teaching Assistant"];

const NAVY = "#1e3a5f";
const serif = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const mono  = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

type AvatarType = "emoji" | "photo";

export default function ProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState("");
    // Student fields
    const [major, setMajor] = useState("");
    const [year, setYear] = useState("");
    const [interests, setInterests] = useState("");
    const [funFact, setFunFact] = useState("");
    // Professor fields
    const [department, setDepartment] = useState("");
    const [title, setTitle] = useState("");
    const [officeHours, setOfficeHours] = useState("");
    const [researchInterests, setResearchInterests] = useState("");
    const [bio, setBio] = useState("");
    const [emoji, setEmoji] = useState("😊");
    const [avatarType, setAvatarType] = useState<AvatarType>("emoji");
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [userType, setUserType] = useState<"student" | "professor">("student");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [uid, setUid] = useState<string | null>(null);

    // Load existing profile
    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const resolvedUid = await ensureAnonymousUid();
            setUid(resolvedUid);

            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 3000)
            );
            const docRef = doc(db, "users", resolvedUid);
            const docSnap = await Promise.race([getDoc(docRef), timeout]) as any;
            if (docSnap?.exists?.()) {
                const data = docSnap.data();
                setName(data.name || "");
                setMajor(data.major || "");
                setYear(data.year || "");
                setInterests(data.interests || "");
                setFunFact(data.funFact || "");
                setDepartment(data.department || "");
                setTitle(data.title || "");
                setOfficeHours(data.officeHours || "");
                setResearchInterests(data.researchInterests || "");
                setBio(data.bio || "");
                setEmoji(data.emoji || "😊");
                setAvatarType(data.avatarType || "emoji");
                setAvatarUri(data.avatarUri || null);
                setUserType(data.userType || "student");
            }
        } catch (e) {
            console.log("Could not initialize auth or load profile:", e);
        }
        setIsLoaded(true);
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "Please allow access to your photo library to upload a profile picture.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled && result.assets[0]) {
            try {
                // Resize to 200x200 and convert to base64 JPEG
                const manipulated = await manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: 200, height: 200 } }],
                    { compress: 0.5, format: SaveFormat.JPEG, base64: true }
                );
                if (manipulated.base64) {
                    const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
                    setAvatarUri(dataUri);
                    setAvatarType("photo");
                }
            } catch (e) {
                console.log("Image processing error:", e);
                Alert.alert("Error", "Could not process the image. Please try another photo.");
            }
        }
    };

    const removePhoto = () => {
        setAvatarUri(null);
        setAvatarType("emoji");
    };

    const saveAndContinue = async () => {
        if (!name.trim()) return;
        if (!uid) {
            console.log("Cannot save profile: user identity is not ready yet.");
            return;
        }

        setIsSaving(true);

        try {
            const profileData: Record<string, any> = {
                name: name.trim(),
                emoji,
                avatarType,
                avatarUri: avatarType === "photo" ? avatarUri : null,
                userType,
                updatedAt: new Date().toISOString(),
            };

            if (userType === "professor") {
                profileData.department = department.trim();
                profileData.title = title;
                profileData.officeHours = officeHours.trim();
                profileData.researchInterests = researchInterests.trim();
                profileData.bio = bio.trim();
            } else {
                profileData.major = major.trim();
                profileData.year = year;
                profileData.interests = interests.trim();
                profileData.funFact = funFact.trim();
            }

            await setDoc(doc(db, "users", uid), profileData);
        } catch (e) {
            console.log("Could not save profile:", e);
        }

        setIsSaving(false);
        router.push("/scanner");
    };

    if (!isLoaded) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>who are you?</Text>
                        <Text style={styles.subtitle}>
                            {userType === "professor"
                                ? "your profile is shown to students when they check into your class"
                                : "tell us about yourself so your classmates can get to know you"}
                        </Text>
                    </View>

                    {/* Avatar Card */}
                    <View style={styles.card}>
                        <View style={styles.avatarPreviewContainer}>
                            <View style={styles.avatarCircle}>
                                {avatarType === "photo" && avatarUri ? (
                                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                                ) : (
                                    <Text style={styles.avatarEmoji}>{emoji}</Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setAvatarType("emoji")}
                                style={[styles.tab, avatarType === "emoji" && styles.tabActive]}
                            >
                                <Text style={[styles.tabText, avatarType === "emoji" && styles.tabTextActive]}>
                                    preset icons
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    if (avatarUri) {
                                        setAvatarType("photo");
                                    } else {
                                        pickImage();
                                    }
                                }}
                                style={[styles.tab, avatarType === "photo" && styles.tabActive]}
                            >
                                <Text style={[styles.tabText, avatarType === "photo" && styles.tabTextActive]}>
                                    upload photo
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {avatarType === "emoji" && (
                            <View style={styles.emojiGrid}>
                                {EMOJI_OPTIONS.map((e) => (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        key={e}
                                        onPress={() => setEmoji(e)}
                                        style={[styles.emojiOption, emoji === e && styles.emojiSelected]}
                                    >
                                        <Text style={styles.emojiText}>{e}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {avatarType === "photo" && (
                            <View style={styles.photoActions}>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={pickImage}
                                    style={styles.photoButton}
                                >
                                    <Text style={styles.photoButtonText}>
                                        {avatarUri ? "📷  change photo" : "📷  choose from library"}
                                    </Text>
                                </TouchableOpacity>
                                {avatarUri && (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={removePhoto}
                                        style={styles.removeButton}
                                    >
                                        <Text style={styles.removeButtonText}>remove photo</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                    
                    {/* Role Selection Card */}
                    <View style={styles.card}>
                        <Text style={styles.label}>your role</Text>
                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setUserType("student")}
                                style={[styles.tab, userType === "student" && styles.tabActive]}
                            >
                                <Text style={[styles.tabText, userType === "student" && styles.tabTextActive]}>
                                    Student
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setUserType("professor")}
                                style={[styles.tab, userType === "professor" && styles.tabActive]}
                            >
                                <Text style={[styles.tabText, userType === "professor" && styles.tabTextActive]}>
                                    Professor
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Fields Card */}
                    <View style={styles.card}>
                    {/* Name */}
                    <View style={styles.section}>
                        <Text style={styles.label}>name *</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="what should people call you?"
                            placeholderTextColor="#bbb"
                        />
                    </View>

                    {userType === "student" ? (
                        <>
                            {/* Major */}
                            <View style={styles.section}>
                                <Text style={styles.label}>major / field</Text>
                                <TextInput
                                    style={styles.input}
                                    value={major}
                                    onChangeText={setMajor}
                                    placeholder="e.g. Computer Science"
                                    placeholderTextColor="#bbb"
                                />
                            </View>

                            {/* Year */}
                            <View style={styles.section}>
                                <Text style={styles.label}>year</Text>
                                <View style={styles.yearGrid}>
                                    {YEAR_OPTIONS.map((y) => (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            key={y}
                                            onPress={() => setYear(y)}
                                            style={[
                                                styles.yearOption,
                                                year === y && styles.yearSelected,
                                            ]}
                                        >
                                            <Text style={[styles.yearText, year === y && styles.yearTextSelected]}>
                                                {y}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Interests */}
                            <View style={styles.section}>
                                <Text style={styles.label}>interests</Text>
                                <TextInput
                                    style={styles.input}
                                    value={interests}
                                    onChangeText={setInterests}
                                    placeholder="e.g. AI, music, hiking, cooking"
                                    placeholderTextColor="#bbb"
                                />
                            </View>

                            {/* Fun Fact */}
                            <View style={styles.section}>
                                <Text style={styles.label}>fun fact</Text>
                                <TextInput
                                    style={[styles.input, styles.multilineInput]}
                                    value={funFact}
                                    onChangeText={setFunFact}
                                    placeholder="something interesting about you!"
                                    placeholderTextColor="#bbb"
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            {/* Title */}
                            <View style={styles.section}>
                                <Text style={styles.label}>title</Text>
                                <View style={styles.yearGrid}>
                                    {TITLE_OPTIONS.map((t) => (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            key={t}
                                            onPress={() => setTitle(title === t ? "" : t)}
                                            style={[styles.yearOption, title === t && styles.yearSelected]}
                                        >
                                            <Text style={[styles.yearText, title === t && styles.yearTextSelected]}>
                                                {t}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Department */}
                            <View style={styles.section}>
                                <Text style={styles.label}>department</Text>
                                <TextInput
                                    style={styles.input}
                                    value={department}
                                    onChangeText={setDepartment}
                                    placeholder="e.g. Computer Science"
                                    placeholderTextColor="#bbb"
                                />
                            </View>

                            {/* Office Hours */}
                            <View style={styles.section}>
                                <Text style={styles.label}>office hours</Text>
                                <TextInput
                                    style={styles.input}
                                    value={officeHours}
                                    onChangeText={setOfficeHours}
                                    placeholder="e.g. Mon & Wed 2–4 pm, Room 305"
                                    placeholderTextColor="#bbb"
                                />
                            </View>

                            {/* Research / Teaching Interests */}
                            <View style={styles.section}>
                                <Text style={styles.label}>research / teaching interests</Text>
                                <TextInput
                                    style={styles.input}
                                    value={researchInterests}
                                    onChangeText={setResearchInterests}
                                    placeholder="e.g. HCI, distributed systems, machine learning"
                                    placeholderTextColor="#bbb"
                                />
                            </View>

                            {/* Bio */}
                            <View style={styles.section}>
                                <Text style={styles.label}>about</Text>
                                <TextInput
                                    style={[styles.input, styles.multilineInput]}
                                    value={bio}
                                    onChangeText={setBio}
                                    placeholder="a short bio students will see on your profile"
                                    placeholderTextColor="#bbb"
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>
                        </>
                    )}
                    </View>{/* end fields card */}

                    {/* Preview Card */}
                    {name.trim() !== "" && (
                        <View style={styles.previewCard}>
                            <Text style={styles.previewLabel}>preview</Text>
                            <View style={styles.previewContent}>
                                {avatarType === "photo" && avatarUri ? (
                                    <Image source={{ uri: avatarUri }} style={styles.previewImage} />
                                ) : (
                                    <Text style={styles.previewEmoji}>{emoji}</Text>
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.previewName}>{name}</Text>
                                    {userType === "student" ? (
                                        <>
                                            {major ? (
                                                <Text style={styles.previewDetail}>{major}{year ? ` • ${year}` : ""}</Text>
                                            ) : null}
                                            {interests ? (
                                                <Text style={styles.previewInterests}>{interests}</Text>
                                            ) : null}
                                        </>
                                    ) : (
                                        <>
                                            {(title || department) ? (
                                                <Text style={styles.previewDetail}>
                                                    {[title, department].filter(Boolean).join(" • ")}
                                                </Text>
                                            ) : null}
                                            {researchInterests ? (
                                                <Text style={styles.previewInterests}>{researchInterests}</Text>
                                            ) : null}
                                        </>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}

                    <View style={{ height: 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Fixed Footer Button */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 28) }]}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={saveAndContinue}
                    disabled={!name.trim() || isSaving || !uid}
                    style={[
                        styles.submitButton,
                        (!name.trim() || !uid) && styles.submitDisabled,
                    ]}
                >
                    <Text style={styles.submitText}>
                        {isSaving ? "Saving..." : userType === "professor" ? "Set Up Class →" : "Enter Class →"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f7f8fa",
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 28,
        backgroundColor: "#f7f8fa",
        borderTopWidth: 1,
        borderTopColor: "#e4e7ed",
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingText: {
        textAlign: "center",
        marginTop: 100,
        fontSize: 16,
        fontFamily: mono,
        color: "#999",
    },

    // Header
    header: {
        marginBottom: 20,
        marginTop: 8,
    },
    title: {
        fontSize: 30,
        fontWeight: "700",
        fontFamily: serif,
        color: "#111",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: mono,
        color: "#888",
        lineHeight: 20,
    },

    // Cards
    card: {
        backgroundColor: "#fff",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#e4e7ed",
        padding: 18,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },

    // Avatar
    avatarPreviewContainer: {
        alignItems: "center",
        marginBottom: 18,
    },
    avatarCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#f0f2f5",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: NAVY,
        overflow: "hidden",
    },
    avatarImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
    },
    avatarEmoji: {
        fontSize: 46,
    },

    // Tabs (avatar type + role)
    tabContainer: {
        flexDirection: "row",
        marginBottom: 16,
        backgroundColor: "#f0f2f5",
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
    },
    tabActive: {
        backgroundColor: NAVY,
    },
    tabText: {
        fontSize: 14,
        fontFamily: mono,
        fontWeight: "600",
        color: "#888",
    },
    tabTextActive: {
        color: "#fff",
    },

    // Form sections
    section: {
        marginBottom: 16,
    },
    label: {
        fontSize: 11,
        fontFamily: mono,
        fontWeight: "600",
        color: "#999",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    input: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        fontFamily: serif,
        color: "#111",
        borderWidth: 1,
        borderColor: "#e4e7ed",
    },
    multilineInput: {
        minHeight: 88,
        paddingTop: 14,
    },

    // Emoji grid
    emojiGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    emojiOption: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: "#f0f2f5",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "transparent",
    },
    emojiSelected: {
        borderColor: NAVY,
        backgroundColor: "#eef1f7",
    },
    emojiText: {
        fontSize: 24,
    },

    // Photo upload
    photoActions: {
        gap: 10,
    },
    photoButton: {
        backgroundColor: "#f7f8fa",
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e4e7ed",
        borderStyle: "dashed",
    },
    photoButtonText: {
        textAlign: "center",
        fontSize: 14,
        fontFamily: mono,
        color: "#555",
        fontWeight: "500",
    },
    removeButton: {
        paddingVertical: 8,
    },
    removeButtonText: {
        textAlign: "center",
        fontSize: 13,
        fontFamily: mono,
        color: "#e53e3e",
        fontWeight: "500",
    },

    // Year / Title pill grids
    yearGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    yearOption: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: "#f0f2f5",
        borderWidth: 1,
        borderColor: "#e4e7ed",
    },
    yearSelected: {
        backgroundColor: NAVY,
        borderColor: NAVY,
    },
    yearText: {
        fontSize: 13,
        fontFamily: mono,
        color: "#555",
        fontWeight: "500",
    },
    yearTextSelected: {
        color: "#fff",
    },

    // Preview card
    previewCard: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#e4e7ed",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    previewLabel: {
        fontSize: 11,
        fontFamily: mono,
        fontWeight: "600",
        color: "#aaa",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    previewContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },
    previewImage: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    previewEmoji: {
        fontSize: 42,
    },
    previewName: {
        fontSize: 18,
        fontWeight: "700",
        fontFamily: serif,
        color: "#111",
    },
    previewDetail: {
        fontSize: 13,
        fontFamily: mono,
        color: "#666",
        marginTop: 3,
    },
    previewInterests: {
        fontSize: 12,
        fontFamily: mono,
        color: "#999",
        marginTop: 3,
    },

    // Submit button
    submitButton: {
        backgroundColor: NAVY,
        paddingVertical: 18,
        borderRadius: 16,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
    },
    submitDisabled: {
        backgroundColor: "#c8cdd6",
        shadowOpacity: 0,
    },
    submitText: {
        color: "#fff",
        fontSize: 17,
        fontFamily: mono,
        fontWeight: "700",
        textAlign: "center",
    },
});
