import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../config/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

const EMOJI_OPTIONS = ["😊", "🤓", "😎", "🧑‍💻", "🎨", "🎵", "⚡", "🌟", "🦊", "🐱", "🌈", "🔥", "💡", "📚", "🎮", "🏀"];
const YEAR_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad Student"];

// Use a fixed test userId for now (would come from auth in production)
const TEST_USER_ID = "test-user-001";

export default function ProfileScreen() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [major, setMajor] = useState("");
    const [year, setYear] = useState("");
    const [interests, setInterests] = useState("");
    const [funFact, setFunFact] = useState("");
    const [emoji, setEmoji] = useState("😊");
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
            }
        } catch (e) {
            console.log("Could not load profile:", e);
        }
        setIsLoaded(true);
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

                    {/* Emoji Picker */}
                    <View style={styles.section}>
                        <Text style={styles.label}>pick your avatar</Text>
                        <View style={styles.emojiGrid}>
                            {EMOJI_OPTIONS.map((e) => (
                                <Pressable
                                    key={e}
                                    onPress={() => setEmoji(e)}
                                    style={[
                                        styles.emojiOption,
                                        emoji === e && styles.emojiSelected,
                                    ]}
                                >
                                    <Text style={styles.emojiText}>{e}</Text>
                                </Pressable>
                            ))}
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
                                <Pressable
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
                                </Pressable>
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

                    {/* Preview Card */}
                    {name.trim() !== "" && (
                        <View style={styles.previewCard}>
                            <Text style={styles.previewLabel}>preview</Text>
                            <View style={styles.previewContent}>
                                <Text style={styles.previewEmoji}>{emoji}</Text>
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

                    {/* Submit Button */}
                    <Pressable
                        onPress={saveAndContinue}
                        disabled={!name.trim() || isSaving}
                        style={({ pressed }) => [
                            styles.submitButton,
                            !name.trim() && styles.submitDisabled,
                            pressed && name.trim() && { transform: [{ scale: 0.97 }] },
                        ]}
                    >
                        <Text style={styles.submitText}>
                            {isSaving ? "Saving..." : "Enter Class →"}
                        </Text>
                    </Pressable>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
    loadingText: {
        textAlign: "center",
        marginTop: 100,
        fontSize: 16,
        color: "#999",
    },
    header: {
        marginBottom: 32,
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
