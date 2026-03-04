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
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

const EMOJI_OPTIONS = ["😊", "🤓", "😎", "🧑‍💻", "🎨", "🎵", "⚡", "🌟", "🦊", "🐱", "🌈", "🔥", "💡", "📚", "🎮", "🏀"];
const YEAR_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad Student"];

// Use a fixed test userId for now (would come from auth in production)
const TEST_USER_ID = "test-user-001";

type AvatarType = "emoji" | "photo";

export default function ProfileScreen() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [major, setMajor] = useState("");
    const [year, setYear] = useState("");
    const [interests, setInterests] = useState("");
    const [funFact, setFunFact] = useState("");
    const [emoji, setEmoji] = useState("😊");
    const [avatarType, setAvatarType] = useState<AvatarType>("emoji");
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load existing profile
    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 3000)
            );
            const docRef = doc(db, "users", TEST_USER_ID);
            const docSnap = await Promise.race([getDoc(docRef), timeout]) as any;
            if (docSnap?.exists?.()) {
                const data = docSnap.data();
                setName(data.name || "");
                setMajor(data.major || "");
                setYear(data.year || "");
                setInterests(data.interests || "");
                setFunFact(data.funFact || "");
                setEmoji(data.emoji || "😊");
                setAvatarType(data.avatarType || "emoji");
                setAvatarUri(data.avatarUri || null);
            }
        } catch (e) {
            console.log("Could not load profile:", e);
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
        setIsSaving(true);

        try {
            await setDoc(doc(db, "users", TEST_USER_ID), {
                name: name.trim(),
                major: major.trim(),
                year,
                interests: interests.trim(),
                funFact: funFact.trim(),
                emoji,
                avatarType,
                avatarUri: avatarType === "photo" ? avatarUri : null,
                updatedAt: new Date().toISOString(),
            });
        } catch (e) {
            console.log("Could not save profile (Firebase may not be configured):", e);
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
                            tell us about yourself so your classmates can get to know you
                        </Text>
                    </View>

                    {/* Avatar Preview */}
                    <View style={styles.avatarPreviewContainer}>
                        <View style={styles.avatarGlow} />
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

                    {/* Name */}
                    <View style={styles.section}>
                        <Text style={styles.label}>name *</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="what should people call you?"
                            placeholderTextColor="rgba(255,255,255,0.25)"
                        />
                    </View>

                    {/* Major */}
                    <View style={styles.section}>
                        <Text style={styles.label}>major / field</Text>
                        <TextInput
                            style={styles.input}
                            value={major}
                            onChangeText={setMajor}
                            placeholder="e.g. Computer Science"
                            placeholderTextColor="rgba(255,255,255,0.25)"
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
                                    <Text
                                        style={[
                                            styles.yearText,
                                            year === y && styles.yearTextSelected,
                                        ]}
                                    >
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
                            placeholderTextColor="rgba(255,255,255,0.25)"
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
                            placeholderTextColor="rgba(255,255,255,0.25)"
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />
                    </View>

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
                                    {major ? (
                                        <Text style={styles.previewDetail}>{major}{year ? ` • ${year}` : ""}</Text>
                                    ) : null}
                                    {interests ? (
                                        <Text style={styles.previewInterests}>{interests}</Text>
                                    ) : null}
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
                    disabled={!name.trim() || isSaving}
                    style={[
                        styles.submitButton,
                        !name.trim() && styles.submitDisabled,
                    ]}
                >
                    <Text style={styles.submitText}>
                        {isSaving ? "Saving..." : "Enter Class →"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a1a",
    },
    footer: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: "#0a0a1a",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.06)",
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    loadingText: {
        textAlign: "center",
        marginTop: 100,
        fontSize: 16,
        color: "rgba(255,255,255,0.4)",
    },
    header: {
        marginBottom: 28,
        marginTop: 8,
    },
    title: {
        fontSize: 34,
        fontWeight: "900",
        color: "#ffffff",
        marginBottom: 8,
        textShadowColor: "rgba(124, 92, 255, 0.3)",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    subtitle: {
        fontSize: 15,
        color: "rgba(255,255,255,0.5)",
        lineHeight: 22,
    },
    avatarPreviewContainer: {
        alignItems: "center",
        marginBottom: 20,
    },
    avatarGlow: {
        position: "absolute",
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: "rgba(124, 92, 255, 0.15)",
        top: -15,
    },
    avatarCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "rgba(255,255,255,0.06)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "rgba(124, 92, 255, 0.5)",
        overflow: "hidden",
        shadowColor: "#7c5cff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
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
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
    },
    tabActive: {
        backgroundColor: "#7c5cff",
    },
    tabText: {
        fontSize: 14,
        fontWeight: "600",
        color: "rgba(255,255,255,0.4)",
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
        color: "rgba(255,255,255,0.4)",
        textTransform: "lowercase",
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: "#ffffff",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
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
        backgroundColor: "rgba(255,255,255,0.06)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "transparent",
    },
    emojiSelected: {
        borderColor: "#7c5cff",
        backgroundColor: "rgba(124, 92, 255, 0.15)",
    },
    emojiText: {
        fontSize: 24,
    },
    photoActions: {
        gap: 10,
    },
    photoButton: {
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(124, 92, 255, 0.3)",
        borderStyle: "dashed",
    },
    photoButtonText: {
        textAlign: "center",
        fontSize: 15,
        color: "rgba(255,255,255,0.6)",
        fontWeight: "500",
    },
    removeButton: {
        paddingVertical: 10,
        borderRadius: 10,
    },
    removeButtonText: {
        textAlign: "center",
        fontSize: 14,
        color: "#f87171",
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
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    yearSelected: {
        backgroundColor: "#7c5cff",
        borderColor: "#7c5cff",
    },
    yearText: {
        fontSize: 14,
        color: "rgba(255,255,255,0.5)",
        fontWeight: "500",
    },
    yearTextSelected: {
        color: "#fff",
    },
    previewCard: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(124, 92, 255, 0.15)",
        shadowColor: "#7c5cff",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    previewLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "rgba(255,255,255,0.3)",
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
        color: "#ffffff",
    },
    previewDetail: {
        fontSize: 14,
        color: "rgba(255,255,255,0.5)",
        marginTop: 2,
    },
    previewInterests: {
        fontSize: 13,
        color: "rgba(255,255,255,0.35)",
        marginTop: 4,
    },
    submitButton: {
        backgroundColor: "#7c5cff",
        paddingVertical: 18,
        borderRadius: 16,
        shadowColor: "#7c5cff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    },
    submitDisabled: {
        backgroundColor: "rgba(255,255,255,0.08)",
        shadowOpacity: 0,
    },
    submitText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        textAlign: "center",
    },
});
