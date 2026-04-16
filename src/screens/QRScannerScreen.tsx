import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { db } from "../config/firebase";
import {
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { ensureAnonymousUid } from "../utils/auth";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from "react-native-reanimated";
import { checkInToSeat, syncRoomManifest } from "../lib/proximityApi";
import { parseSeatScanPayload } from "../lib/qrPayload";
import { buildSeatManifest, DEFAULT_LAYOUT, parseTagId, resolveSeatByLabel } from "../lib/seating";
import { bootstrapTestRoom, isTestSupportEnabled } from "../lib/testSupport";

const NAVY  = "#1e3a5f";
const serif = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const mono  = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

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

export default function QRScannerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [uid, setUid] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isResolvingScan, setIsResolvingScan] = useState(false);
    const canUseTestSupport = isTestSupportEnabled();

    useEffect(() => {
        const initializeIdentity = async () => {
            try {
                const resolvedUid = await ensureAnonymousUid();
                setUid(resolvedUid);
            } catch (e) {
                console.log("Could not initialize anonymous auth for scanner:", e);
            }
        };

        initializeIdentity();
    }, []);

    const startScanning = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                return;
            }
        }
        setErrorMessage(null);
        setScannedData(null);
        setIsScanning(true);
    };

    const stopScanning = () => {
        setIsScanning(false);
        setScannedData(null);
        setErrorMessage(null);
        setIsResolvingScan(false);
    };

    const resolveUserType = async () => {
        const resolvedUid = uid ?? await ensureAnonymousUid();
        if (!uid) setUid(resolvedUid);

        const userSnap = await getDoc(doc(db, "users", resolvedUid));
        const userType = userSnap.exists() ? userSnap.data().userType : "student";
        return { resolvedUid, userType };
    };

    const resolveRoomIdFromTag = async (tagId: string) => {
        const tagSnap = await getDocs(
            query(collectionGroup(db, "seatTags"), where("tagId", "==", tagId))
        );
        const first = tagSnap.docs[0];
        if (first) {
            return first.data().roomId as string | undefined;
        }

        return parseTagId(tagId)?.roomId;
    };

    const handleStudentCheckIn = async (tagId: string) => {
        const result = await checkInToSeat(tagId, "qr");
        router.push(
            `/classroom?roomId=${result.roomId}&seatId=${result.seatId}&seatLabel=${encodeURIComponent(result.seatLabel)}` as any
        );
    };

    const handleLegacyPayload = async (roomId: string, rawSeatLabel: string) => {
        const roomSnap = await getDoc(doc(db, "rooms", roomId));
        const layout = roomSnap.exists() && roomSnap.data().layout
            ? roomSnap.data().layout
            : DEFAULT_LAYOUT;
        const seats = buildSeatManifest(roomId, layout);
        const seat = resolveSeatByLabel(seats, rawSeatLabel);

        if (!seat) {
            throw new Error(`Could not resolve seat ${rawSeatLabel} in room ${roomId}.`);
        }

        await syncRoomManifest(roomId);
        return handleStudentCheckIn(seat.tagId);
    };

    const handleBarcodeScanned = async (data: string) => {
        setScannedData(data);
        setIsScanning(false);
        setIsResolvingScan(true);
        setErrorMessage(null);

        try {
            const { userType } = await resolveUserType();
            const payload = parseSeatScanPayload(data);

            if (payload?.kind === "professor-room") {
                if (userType !== "professor") {
                    throw new Error("This QR code is for professor dashboard access only.");
                }

                await syncRoomManifest(payload.roomId);
                router.push(`/professor?roomId=${payload.roomId}` as any);
                return;
            }

            if (payload?.kind === "tag") {
                const tagId = payload.tagId;
                if (userType === "professor") {
                    const roomId = await resolveRoomIdFromTag(tagId);
                    if (!roomId) {
                        throw new Error("That seat tag does not resolve to a room yet.");
                    }
                    router.push(`/professor?roomId=${roomId}` as any);
                } else {
                    await handleStudentCheckIn(tagId);
                }
                return;
            }

            if (!payload || payload.kind !== "legacy-seat") {
                throw new Error("Unsupported QR code format.");
            }

            const { roomId, seatLabel } = payload;
            if (userType === "professor") {
                router.push(`/professor?roomId=${roomId}` as any);
            } else {
                await handleLegacyPayload(roomId, seatLabel);
            }
        } catch (e) {
            console.log("Could not process scan:", e);
            setErrorMessage(e instanceof Error ? e.message : "Could not process that QR code.");
            setScannedData(null);
        } finally {
            setIsResolvingScan(false);
        }
    };

    const handleTestBypass = async () => {
        setScannedData("test-bypass");
        setIsResolvingScan(true);
        setErrorMessage(null);

        try {
            const { userType } = await resolveUserType();
            const result = await bootstrapTestRoom(userType === "professor" ? "professor" : "student");
            if (!result.ok) {
                console.log("Test room bootstrap failed:", result.code, result.cause);
                setErrorMessage(result.message);
                setScannedData(null);
                return;
            }

            if (result.route === "professor") {
                router.push(`/professor?roomId=${result.roomId}` as any);
                return;
            }

            router.push(
                `/classroom?roomId=${result.roomId}&seatId=${result.seatId}&seatLabel=${encodeURIComponent(result.seatLabel || "—")}` as any
            );
        } catch (e) {
            console.log("Unexpected test room bypass failure:", e);
            setErrorMessage(e instanceof Error ? e.message : "Could not join the test room.");
            setScannedData(null);
        } finally {
            setIsResolvingScan(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <Animated.View style={styles.contentWrapper}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Check In</Text>
                    <Text style={styles.subtitle}>
                        Scan the QR code on your desk to get started
                    </Text>
                </View>

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
                                    Scan Desk QR Code
                                </Text>
                            </TouchableOpacity>

                            {canUseTestSupport ? (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={handleTestBypass}
                                    style={styles.bypassButton}
                                >
                                    <Text style={styles.bypassButtonText}>
                                        Skip — Use Test Room
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    )}

                    {/* Camera scanner */}
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

                    {isResolvingScan && (
                        <View style={styles.resultCard}>
                            <Text style={styles.resultTitle}>Joining Seat…</Text>
                            <Text style={styles.resultData}>
                                Resolving your seat tag and loading the classroom.
                            </Text>
                        </View>
                    )}

                    {errorMessage && !isScanning && !isResolvingScan && (
                        <View style={styles.errorCard}>
                            <Text style={styles.errorTitle}>Scan Failed</Text>
                            <Text style={styles.errorBody}>{errorMessage}</Text>
                        </View>
                    )}

                    {/* Scanned result (non-matching QR) */}
                    {scannedData && !isResolvingScan && (
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

                            {canUseTestSupport ? (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={handleTestBypass}
                                    style={styles.bypassButton}
                                >
                                    <Text style={styles.bypassButtonText}>
                                        Enter Test Room Instead
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f7f8fa",
        justifyContent: "center",
        alignItems: "center",
    },
    contentWrapper: {
        width: "100%",
        maxWidth: 448,
        padding: 20,
    },

    // Header
    header: {
        marginBottom: 20,
        paddingHorizontal: 4,
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

    // Main card
    card: {
        backgroundColor: "#fff",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#e4e7ed",
        padding: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },

    // QR icon
    iconContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 32,
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
        borderColor: NAVY,
        borderRadius: 4,
        position: "relative",
    },
    qrCorner: {
        position: "absolute",
        width: 16,
        height: 16,
        borderWidth: 1.5,
        borderColor: NAVY,
        borderRadius: 2,
        justifyContent: "center",
        alignItems: "center",
    },
    qrDot: {
        width: 6,
        height: 6,
        backgroundColor: NAVY,
        borderRadius: 1,
    },

    // Buttons
    primaryButton: {
        backgroundColor: NAVY,
        paddingVertical: 18,
        borderRadius: 14,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontFamily: mono,
        fontWeight: "700",
        textAlign: "center",
    },
    bypassButton: {
        backgroundColor: "#f0f2f5",
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e4e7ed",
    },
    bypassButtonText: {
        color: "#666",
        fontSize: 14,
        fontFamily: mono,
        fontWeight: "500",
        textAlign: "center",
    },
    cancelButton: {
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: NAVY,
        paddingVertical: 14,
        borderRadius: 12,
    },
    cancelButtonText: {
        color: NAVY,
        fontFamily: mono,
        fontWeight: "600",
        textAlign: "center",
        fontSize: 15,
    },

    // Camera
    cameraContainer: {
        backgroundColor: "#000",
        borderRadius: 16,
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
        borderColor: "rgba(255, 255, 255, 0.4)",
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
        borderColor: "#fff",
        borderTopLeftRadius: 8,
    },
    cornerTR: {
        top: 0,
        right: 0,
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderColor: "#fff",
        borderTopRightRadius: 8,
    },
    cornerBL: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 2,
        borderLeftWidth: 2,
        borderColor: "#fff",
        borderBottomLeftRadius: 8,
    },
    cornerBR: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 2,
        borderRightWidth: 2,
        borderColor: "#fff",
        borderBottomRightRadius: 8,
    },
    scanLine: {
        position: "absolute",
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: "rgba(255,255,255,0.7)",
    },

    // Result card
    resultCard: {
        backgroundColor: "#f7f8fa",
        borderWidth: 1,
        borderColor: "#e4e7ed",
        borderRadius: 16,
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
        backgroundColor: NAVY,
        justifyContent: "center",
        alignItems: "center",
    },
    resultTitle: {
        fontFamily: serif,
        fontWeight: "700",
        color: "#111",
        textAlign: "center",
        fontSize: 17,
        marginBottom: 6,
    },
    resultData: {
        fontSize: 12,
        fontFamily: mono,
        color: "#888",
        textAlign: "center",
    },
    errorCard: {
        backgroundColor: "#fff3f0",
        borderWidth: 1,
        borderColor: "#f0c2b5",
        borderRadius: 16,
        padding: 20,
    },
    errorTitle: {
        fontFamily: serif,
        fontWeight: "700",
        color: "#7a2d14",
        fontSize: 16,
        marginBottom: 6,
        textAlign: "center",
    },
    errorBody: {
        fontFamily: mono,
        fontSize: 12,
        color: "#9a4a31",
        textAlign: "center",
        lineHeight: 18,
    },
});
