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
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../config/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ensureAnonymousUid } from "../utils/auth";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

const EMOJI_OPTIONS = ["😊", "🤓", "😎", "🧑‍💻", "🎨", "🎵", "⚡", "🌟", "🦊", "🐱", "🌈", "🔥", "💡", "📚", "🎮", "🏀"];
const YEAR_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad Student"];
const TITLE_OPTIONS = ["Professor", "Assoc. Professor", "Asst. Professor", "Lecturer", "Teaching Assistant"];

type AvatarType = "emoji" | "photo";

export default function ProfileScreen() {
    const router = useRouter();
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
        <SafeAreaView style={styles.container}>
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

                    {/* Avatar Preview */}
                    <View style={styles.avatarPreviewContainer}>
                        <View style={styles.avatarCircle}>
                            {avatarType === "photo" && avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarEmoji}>{emoji}</Text>
                            )}
                        </View>
                    </View>

                    {/* Avatar Type Tabs */}
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

                    {/* Emoji Grid (shown when emoji tab is active) */}
                    {avatarType === "emoji" && (
                        <View style={styles.section}>
                            <View style={styles.emojiGrid}>
                                {EMOJI_OPTIONS.map((e) => (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        key={e}
                                        onPress={() => setEmoji(e)}
                                        style={[
                                            styles.emojiOption,
                                            emoji === e && styles.emojiSelected,
                                        ]}
                                    >
                                        <Text style={styles.emojiText}>{e}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Photo Upload (shown when photo tab is active) */}
                    {avatarType === "photo" && (
                        <View style={styles.section}>
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
                        </View>
                    )}
                    
                    {/* Role Selection */}
                    <View style={styles.section}>
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

                    {/* Name */}
                    <View style={styles.section}>
                        <Text style={styles.label}>name *</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="what should people call you?"
                            placeholderTextColor="#999"
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
                                    placeholderTextColor="#999"
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
                                    placeholderTextColor="#999"
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
                                    placeholderTextColor="#999"
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
                                    placeholderTextColor="#999"
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
                                    placeholderTextColor="#999"
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
                                    placeholderTextColor="#999"
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
                                    placeholderTextColor="#999"
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>
                        </>
                    )}

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
            <View style={styles.footer}>
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
        backgroundColor: "#fff",
    },
    footer: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    loadingText: {
        textAlign: "center",
        marginTop: 100,
        fontSize: 16,
        color: "#999",
    },
    header: {
        marginBottom: 24,
        marginTop: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: "900",
        color: "#000",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: "#666",
        lineHeight: 22,
    },
    avatarPreviewContainer: {
        alignItems: "center",
        marginBottom: 20,
    },
    avatarCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#f5f5f5",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: "#000",
        overflow: "hidden",
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarEmoji: {
        fontSize: 48,
    },
    tabContainer: {
        flexDirection: "row",
        marginBottom: 16,
        backgroundColor: "#f5f5f5",
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
        backgroundColor: "#000",
    },
    tabText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#666",
    },
    tabTextActive: {
        color: "#fff",
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        color: "#999",
        textTransform: "lowercase",
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: "#f5f5f5",
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: "#000",
        borderWidth: 1,
        borderColor: "#eee",
    },
    multilineInput: {
        minHeight: 80,
        paddingTop: 16,
    },
    emojiGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    emojiOption: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: "#f5f5f5",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "transparent",
    },
    emojiSelected: {
        borderColor: "#000",
        backgroundColor: "#f0f0ff",
    },
    emojiText: {
        fontSize: 24,
    },
    photoActions: {
        gap: 10,
    },
    photoButton: {
        backgroundColor: "#f5f5f5",
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#eee",
        borderStyle: "dashed",
    },
    photoButtonText: {
        textAlign: "center",
        fontSize: 15,
        color: "#333",
        fontWeight: "500",
    },
    removeButton: {
        paddingVertical: 10,
        borderRadius: 10,
    },
    removeButtonText: {
        textAlign: "center",
        fontSize: 14,
        color: "#e53e3e",
        fontWeight: "500",
    },
    yearGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    yearOption: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: "#f5f5f5",
        borderWidth: 1,
        borderColor: "#eee",
    },
    yearSelected: {
        backgroundColor: "#000",
        borderColor: "#000",
    },
    yearText: {
        fontSize: 14,
        color: "#333",
        fontWeight: "500",
    },
    yearTextSelected: {
        color: "#fff",
    },
    previewCard: {
        backgroundColor: "#fafafa",
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "#eee",
    },
    previewLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "#bbb",
        textTransform: "uppercase",
        marginBottom: 12,
        letterSpacing: 1,
    },
    previewContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    previewImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    previewEmoji: {
        fontSize: 40,
    },
    previewName: {
        fontSize: 18,
        fontWeight: "700",
        color: "#000",
    },
    previewDetail: {
        fontSize: 14,
        color: "#666",
        marginTop: 2,
    },
    previewInterests: {
        fontSize: 13,
        color: "#999",
        marginTop: 4,
    },
    submitButton: {
        backgroundColor: "#000",
        paddingVertical: 18,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    submitDisabled: {
        backgroundColor: "#ccc",
        shadowOpacity: 0,
    },
    submitText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        textAlign: "center",
    },
});
