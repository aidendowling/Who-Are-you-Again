import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from "react-native-reanimated";

function ScanningOverlay() {
    const scanLineTop = useSharedValue(0);

    useEffect(() => {
        scanLineTop.value = withRepeat(
            withTiming(1, { duration: 2000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const scanLineStyle = useAnimatedStyle(() => ({
        top: `${scanLineTop.value * 100}%` as any,
    }));

    return (
        <View style={styles.overlayContainer}>
            <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <Animated.View style={[styles.scanLine, scanLineStyle]} />
            </View>
        </View>
    );
}

/** Isolated camera component — unmounting fully releases camera hardware */
function QRCameraScanner({ onScan }: { onScan: (data: string) => void }) {
    const [mounted, setMounted] = useState(true);
    const hasScanned = useRef(false);

    useEffect(() => {
        setMounted(true);
        hasScanned.current = false;
        return () => {
            // Signal unmount — this triggers CameraView's native cleanup
            setMounted(false);
        };
    }, []);

    const handleScan = useCallback(({ data }: { data: string }) => {
        if (!hasScanned.current) {
            hasScanned.current = true;
            onScan(data);
        }
    }, [onScan]);

    if (!mounted) return null;

    return (
        <View style={styles.cameraContainer}>
            <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
                onBarcodeScanned={handleScan}
            />
            <ScanningOverlay />
        </View>
    );
}

const TEST_USER_ID = "test-user-001";

export default function QRScannerScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [seatInput, setSeatInput] = useState("");
    const [showSeatInput, setShowSeatInput] = useState(false);

    const startScanning = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                return;
            }
        }
        setScannedData(null);
        setIsScanning(true);
    };

    const stopScanning = () => {
        setIsScanning(false);
        setScannedData(null);
    };

    const handleBarcodeScanned = async (data: string) => {
        setScannedData(data);
        setIsScanning(false);

        // Assign random seat 1-144 for generic codes
        const randomSeat = Math.floor(Math.random() * 144) + 1;
        // Parse QR data — expected format: wh0ru://room/{roomId}/seat/{seatId}
        const match = data.match(/wh0ru:\/\/room\/(.+)\/seat\/(.+)/);
        if (match) {
            const roomId = match[1];
            const seat = match[2]; // Use seat from QR code
            console.log("Assigned seat from QR:", seat);
            try {
                const userSnap = await getDoc(doc(db, "users", TEST_USER_ID));
                const userType = userSnap.exists() ? userSnap.data().userType : "student";
                if (userType === "professor") {
                    router.push(`/professor?roomId=${roomId}` as any);
                } else {
                    router.push(`/classroom?roomId=${roomId}&seat=${seat}` as any);
                }
            } catch (e) {
                console.log("Error fetching user profile:", e);
                router.push(`/classroom?roomId=${roomId}&seat=${seat}`);
            }
        } else {
            // If QR doesn't match, send to test room with random seat
            const seat = randomSeat.toString();
            console.log("Assigned random seat:", seat);
            router.push(`/classroom?roomId=test-room&seat=${seat}` as any);
        }
    };

    const handleTestBypass = async () => {
        // Check user type
        try {
            const userSnap = await getDoc(doc(db, "users", TEST_USER_ID));
            const userType = userSnap.exists() ? userSnap.data().userType : "student";
            if (userType === "professor") {
                router.push(`/professor?roomId=test-room` as any);
            } else {
                setShowSeatInput(true);
            }
        } catch (e) {
            setShowSeatInput(true);
        }
    };

    const handleSeatSubmit = () => {
        const seat = seatInput.trim() || "A3";
        router.push(`/classroom?roomId=test-room&seat=${seat}` as any);
        setShowSeatInput(false);
        setSeatInput("");
    };

    return (
        <View style={styles.container}>
            <Animated.View style={styles.contentWrapper}>
                <View style={styles.card}>
                    {/* QR Icon */}
                    <View style={styles.iconContainer}>
                        <View style={styles.qrIcon}>
                            <View style={styles.qrSquare}>
                                <View style={[styles.qrCorner, { top: 4, left: 4 }]}>
                                    <View style={styles.qrDot} />
                                </View>
                                <View style={[styles.qrCorner, { top: 4, right: 4 }]}>
                                    <View style={styles.qrDot} />
                                </View>
                                <View style={[styles.qrCorner, { bottom: 4, left: 4 }]}>
                                    <View style={styles.qrDot} />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Initial state — scan & bypass buttons */}
                    {!isScanning && !scannedData && (
                        <View style={{ gap: 12 }}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={startScanning}
                                style={styles.primaryButton}
                            >
                                <Text style={styles.primaryButtonText}>
                                    scan desk QR code
                                </Text>
                            </TouchableOpacity>

                            {/* Test bypass button */}
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleTestBypass}
                                style={styles.bypassButton}
                            >
                                <Text style={styles.bypassButtonText}>
                                    Enter Test Room
                                </Text>
                            </TouchableOpacity>
                            {showSeatInput && (
                                <View style={{ gap: 8 }}>
                                    <Text style={{ fontSize: 15, color: '#333', textAlign: 'center' }}>Enter Your Seat Number:</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <TextInput
                                                value={seatInput}
                                                onChangeText={setSeatInput}
                                                placeholder="Seat Number"
                                                style={{
                                                    borderWidth: 1,
                                                    borderColor: '#ccc',
                                                    borderRadius: 8,
                                                    padding: 10,
                                                    fontSize: 16,
                                                    backgroundColor: '#fff',
                                                }}
                                            />
                                        </View>
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={handleSeatSubmit}
                                            style={{
                                                backgroundColor: '#000',
                                                borderRadius: 8,
                                                paddingVertical: 10,
                                                paddingHorizontal: 16,
                                            }}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Submit</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Camera scanner — separate component for clean lifecycle */}
                    {isScanning && (
                        <View style={{ gap: 16 }}>
                            <QRCameraScanner onScan={handleBarcodeScanned} />
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={stopScanning}
                                style={styles.cancelButton}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Scanned result (non-matching QR) */}
                    {scannedData && (
                        <View style={{ gap: 16 }}>
                            <View style={styles.resultCard}>
                                <View style={styles.checkContainer}>
                                    <View style={styles.checkCircle}>
                                        <Text style={{ color: "#fff", fontSize: 24 }}>✓</Text>
                                    </View>
                                </View>
                                <Text style={styles.resultTitle}>QR Code Scanned!</Text>
                                <Text style={styles.resultData}>{scannedData}</Text>
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => setScannedData(null)}
                                style={styles.primaryButton}
                            >
                                <Text style={styles.primaryButtonText}>Scan Another</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleTestBypass}
                                style={styles.bypassButton}
                            >
                                <Text style={styles.bypassButtonText}>
                                    Enter Test Room Instead
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <Text style={styles.helpText}>
                    Scan the QR code on your desk to check in
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
    },
    contentWrapper: {
        width: "100%",
        maxWidth: 448,
        padding: 24,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 32,
    },
    iconContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 40,
    },
    qrIcon: {
        width: 64,
        height: 64,
        justifyContent: "center",
        alignItems: "center",
    },
    qrSquare: {
        width: 56,
        height: 56,
        borderWidth: 1.5,
        borderColor: "#000",
        borderRadius: 4,
        position: "relative",
    },
    qrCorner: {
        position: "absolute",
        width: 16,
        height: 16,
        borderWidth: 1.5,
        borderColor: "#000",
        borderRadius: 2,
        justifyContent: "center",
        alignItems: "center",
    },
    qrDot: {
        width: 6,
        height: 6,
        backgroundColor: "#000",
        borderRadius: 1,
    },
    primaryButton: {
        backgroundColor: "#000",
        paddingVertical: 18,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "600",
        textAlign: "center",
    },
    bypassButton: {
        backgroundColor: "#f5f5f5",
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#eee",
    },
    bypassButtonText: {
        color: "#666",
        fontSize: 15,
        fontWeight: "500",
        textAlign: "center",
    },
    cancelButton: {
        backgroundColor: "#fff",
        borderWidth: 2,
        borderColor: "#000",
        paddingVertical: 14,
        borderRadius: 12,
    },
    cancelButtonText: {
        color: "#000",
        fontWeight: "600",
        textAlign: "center",
        fontSize: 16,
    },
    cameraContainer: {
        backgroundColor: "#000",
        borderRadius: 12,
        overflow: "hidden",
        aspectRatio: 1,
    },
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
    },
    scanFrame: {
        width: 256,
        height: 256,
        borderWidth: 2,
        borderColor: "rgba(255, 255, 255, 0.5)",
        borderRadius: 16,
        position: "relative",
        overflow: "hidden",
    },
    corner: {
        position: "absolute",
        width: 32,
        height: 32,
    },
    cornerTL: {
        top: 0,
        left: 0,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderColor: "#000",
        borderTopLeftRadius: 8,
    },
    cornerTR: {
        top: 0,
        right: 0,
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderColor: "#000",
        borderTopRightRadius: 8,
    },
    cornerBL: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 2,
        borderLeftWidth: 2,
        borderColor: "#000",
        borderBottomLeftRadius: 8,
    },
    cornerBR: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 2,
        borderRightWidth: 2,
        borderColor: "#000",
        borderBottomRightRadius: 8,
    },
    scanLine: {
        position: "absolute",
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: "#000",
    },
    resultCard: {
        backgroundColor: "#fff",
        borderWidth: 2,
        borderColor: "#000",
        borderRadius: 12,
        padding: 24,
    },
    checkContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    checkCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
    resultTitle: {
        fontWeight: "600",
        color: "#000",
        textAlign: "center",
        fontSize: 16,
        marginBottom: 8,
    },
    resultData: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
    },
    helpText: {
        textAlign: "center",
        color: "#999",
        fontSize: 14,
        marginTop: 24,
    },
});
