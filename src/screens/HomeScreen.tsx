import { useEffect } from "react";
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from "react-native";
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
    const pulseScale = useSharedValue(1);

    useEffect(() => {
        pulseOpacity.value = withRepeat(
            withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
        pulseScale.value = withRepeat(
            withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        opacity: pulseOpacity.value,
        transform: [{ scale: pulseScale.value }],
    }));

    return (
        <View style={styles.buttonWrapper}>
            {/* Outer glow ring */}
            <Animated.View style={[styles.outerGlow, pulseStyle]} />

            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onPress}
                style={styles.buttonPressable}
            >
                <BlurView
                    intensity={40}
                    tint="dark"
                    style={styles.blurContent}
                >
                    {/* Inner shimmer overlay */}
                    <Animated.View style={[styles.pulseOverlay, { opacity: 0.15 }]} />

                    <Text style={styles.buttonText}>
                        ݁₊⊹. ݁ʚ hi ɞ. ⟡ ݁.⊹
                    </Text>
                </BlurView>
            </TouchableOpacity>
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
            {/* Radial glow behind circular text */}
            <View style={styles.radialGlow} />
            <View style={styles.radialGlowInner} />

            <CircularText />
            <GlassyButton onPress={handlePress} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a1a",
        justifyContent: "center",
        alignItems: "center",
    },
    radialGlow: {
        position: "absolute",
        width: 360,
        height: 360,
        borderRadius: 180,
        backgroundColor: "rgba(124, 92, 255, 0.08)",
    },
    radialGlowInner: {
        position: "absolute",
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: "rgba(180, 76, 255, 0.06)",
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
        color: "#ffffff",
        textShadowColor: "rgba(124, 92, 255, 0.5)",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 12,
    },
    buttonWrapper: {
        position: "absolute",
        zIndex: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    outerGlow: {
        position: "absolute",
        width: 160,
        height: 60,
        borderRadius: 38,
        backgroundColor: "rgba(124, 92, 255, 0.25)",
        shadowColor: "#7c5cff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 30,
    },
    buttonPressable: {
        borderRadius: 38,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(124, 92, 255, 0.4)",
        shadowColor: "#7c5cff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 12,
    },
    blurContent: {
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 38,
        overflow: "hidden",
    },
    pulseOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(124, 92, 255, 0.3)",
        borderRadius: 38,
    },
    buttonText: {
        color: "#d4c4ff",
        fontSize: 20,
        textAlign: "center",
        letterSpacing: -0.7,
        textShadowColor: "rgba(124, 92, 255, 0.6)",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
});
