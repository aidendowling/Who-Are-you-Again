import { useEffect } from "react";
import { View, Text, Pressable, Dimensions, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CENTER_X = SCREEN_WIDTH / 2;
const CENTER_Y = SCREEN_HEIGHT / 2;
const RADIUS = 130;
const TEXT = " WHO ARE YOU AGAIN ?";

function CircularText() {
    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const characters = TEXT.split("");

    return (
        <Animated.View
            style={[
                styles.circularTextContainer,
                animatedStyle,
            ]}
        >
            {characters.map((char, i) => {
                const angle = (i / characters.length) * 2 * Math.PI - Math.PI / 2;
                const x = Math.cos(angle) * RADIUS;
                const y = Math.sin(angle) * RADIUS;
                const charRotation = (angle * 180) / Math.PI + 90;

                return (
                    <View
                        key={i}
                        style={[
                            styles.charContainer,
                            {
                                transform: [
                                    { translateX: x },
                                    { translateY: y },
                                    { rotate: `${charRotation}deg` },
                                ],
                            },
                        ]}
                    >
                        <Text style={styles.charText}>{char}</Text>
                    </View>
                );
            })}
        </Animated.View>
    );
}

function GlassyButton({ onPress }: { onPress: () => void }) {
    const pulseOpacity = useSharedValue(0);

    useEffect(() => {
        pulseOpacity.value = withRepeat(
            withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        opacity: pulseOpacity.value,
    }));

    return (
        <View style={styles.buttonWrapper}>
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [
                    styles.buttonPressable,
                    pressed && { transform: [{ scale: 0.95 }] },
                ]}
            >
                <BlurView
                    intensity={40}
                    tint="light"
                    style={styles.blurContent}
                >
                    {/* Pulse glow overlay */}
                    <Animated.View style={[styles.pulseOverlay, pulseStyle]} />

                    <Text style={styles.buttonText}>
                        ݁₊⊹. ݁ʚ hi ɞ. ⟡ ݁.⊹
                    </Text>
                </BlurView>
            </Pressable>
        </View>
    );
}

export default function HomeScreen() {
    const router = useRouter();

    const handlePress = () => {
        setTimeout(() => {
            router.push("/profile");
        }, 300);
    };

    return (
        <View style={styles.container}>
            <CircularText />
            <GlassyButton onPress={handlePress} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#ffffff",
        justifyContent: "center",
        alignItems: "center",
    },
    circularTextContainer: {
        width: RADIUS * 2 + 40,
        height: RADIUS * 2 + 40,
        justifyContent: "center",
        alignItems: "center",
        position: "absolute",
    },
    charContainer: {
        position: "absolute",
        justifyContent: "center",
        alignItems: "center",
    },
    charText: {
        fontSize: 32,
        fontWeight: "900",
        color: "#000000",
    },
    buttonWrapper: {
        position: "absolute",
        zIndex: 20,
    },
    buttonPressable: {
        borderRadius: 38,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.3)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    blurContent: {
        paddingHorizontal: 22,
        paddingVertical: 12,
        borderRadius: 38,
        overflow: "hidden",
    },
    pulseOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        borderRadius: 38,
    },
    buttonText: {
        color: "#bfc8ff",
        fontSize: 20,
        textAlign: "center",
        letterSpacing: -0.7,
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});
