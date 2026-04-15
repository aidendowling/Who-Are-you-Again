import { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Image,
    FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../config/firebase";
import { doc, setDoc, collection, onSnapshot, updateDoc } from "firebase/firestore";

interface StudentInfo {
    id: string;
    name: string;
    emoji: string;
    avatarType: string;
    avatarUri: string | null;
    major: string;
    year: string;
    interests: string;
    seat: string;
    handRaised: boolean;
}

export default function ProfessorDashboardScreen() {
    const router = useRouter();
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const [students, setStudents] = useState<StudentInfo[]>([]);

    useEffect(() => {
        if (!roomId) return;

        try {
            const roomRef = collection(db, "rooms", roomId, "checkins");
            const unsubscribe = onSnapshot(roomRef, (snapshot) => {
                const studentList: StudentInfo[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    // Professors might also check in, but we mainly care about students
                    if (data.userType === "student" || !data.userType) {
                        studentList.push({
                            id: doc.id,
                            name: data.name || "Anonymous",
                            emoji: data.emoji || "😊",
                            avatarType: data.avatarType || "emoji",
                            avatarUri: data.avatarUri || null,
                            major: data.major || "",
                            year: data.year || "",
                            interests: data.interests || "",
                            seat: data.seat || "?",
                            handRaised: data.handRaised || false,
                        });
                    }
                });
                setStudents(studentList);
            });

            return () => unsubscribe();
        } catch (e) {
            console.log("Could not listen to room:", e);
        }
    }, [roomId]);

    const clearHandRaise = async (studentId: string) => {
        if (!roomId) return;
        try {
            await updateDoc(doc(db, "rooms", roomId, "checkins", studentId), {
                handRaised: false
            });
        } catch (e) {
            console.log("Could not clear hand raise:", e);
        }
    };

    const raisedHandsCount = students.filter(s => s.handRaised).length;

    // Helper: convert row and col indices to letter-number format (A1, A2, B1, etc)
    const getSeatLabel = (rowIdx: number, colIdx: number) => {
        const rowLetter = String.fromCharCode(65 + rowIdx); // 65 = 'A'
        const colNumber = colIdx + 1;
        return `${rowLetter}${colNumber}`;
    };

    // Map seat labels to student info
    const seatMap: { [seat: string]: StudentInfo } = {};
    students.forEach(student => {
        if (student.seat) {
            seatMap[student.seat] = student;
        }
    });

    // Get ordered raised hands
    const raisedHands = students
        .filter(s => s.handRaised)
        .sort((a, b) => {
            // If you want to use a timestamp, add it to StudentInfo and sort by it
            // For now, sort by id as a placeholder
            return a.id.localeCompare(b.id);
        });

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.roomTitle}>
                        {roomId === "test-room" ? "Test Classroom" : `Room ${roomId}`}
                    </Text>
                    <Text style={styles.dashboardLabel}>Professor Dashboard</Text>
                </View>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.dismissAll()}
                    style={styles.leaveButton}
                >
                    <Text style={styles.leaveText}>Clear & Exit</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statValue}>{students.length}</Text>
                    <Text style={styles.statLabel}>Students</Text>
                </View>
                <View style={[styles.statBox, raisedHandsCount > 0 && styles.statBoxActive]}>
                    <Text style={[styles.statValue, raisedHandsCount > 0 && styles.statValueActive]}>
                        {raisedHandsCount}
                    </Text>
                    <Text style={[styles.statLabel, raisedHandsCount > 0 && styles.statLabelActive]}>
                        Hand Raises
                    </Text>
                </View>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.sectionLabel}>SEAT MAP</Text>
                <View style={styles.seatGridContainer}>
                    {[...Array(12)].map((_, rowIdx) => (
                        <View key={rowIdx} style={styles.seatRow}>
                            {/* Section 1 */}
                            {[...Array(4)].map((_, colIdx) => {
                                const seatLabel = getSeatLabel(rowIdx, colIdx);
                                const student = seatMap[seatLabel];
                                return (
                                    <SeatBox key={seatLabel} student={student} seatLabel={seatLabel} />
                                );
                            })}
                            {/* Gap */}
                            <View style={styles.seatGap} />
                            {/* Section 2 */}
                            {[...Array(4)].map((_, colIdx) => {
                                const seatLabel = getSeatLabel(rowIdx, colIdx + 4);
                                const student = seatMap[seatLabel];
                                return (
                                    <SeatBox key={seatLabel} student={student} seatLabel={seatLabel} />
                                );
                            })}
                            {/* Gap */}
                            <View style={styles.seatGap} />
                            {/* Section 3 */}
                            {[...Array(4)].map((_, colIdx) => {
                                const seatLabel = getSeatLabel(rowIdx, colIdx + 8);
                                const student = seatMap[seatLabel];
                                return (
                                    <SeatBox key={seatLabel} student={student} seatLabel={seatLabel} />
                                );
                            })}
                        </View>
                    ))}
                </View>
                <Text style={styles.sectionLabel}>RAISED HANDS</Text>
                <View style={styles.raisedHandList}>
                    {raisedHands.length === 0 ? (
                        <Text style={styles.emptyText}>No hands raised</Text>
                    ) : (
                        raisedHands.map((student) => (
                            <View key={student.id} style={styles.raisedHandItem}>
                                {student.avatarType === "photo" && student.avatarUri ? (
                                    <Image source={{ uri: student.avatarUri }} style={styles.raisedHandPhoto} />
                                ) : (
                                    <Text style={styles.raisedHandEmoji}>{student.emoji}</Text>
                                )}
                                <Text style={styles.raisedHandName}>{student.name}</Text>
                                <Text style={styles.raisedHandSeat}>Seat {student.seat}</Text>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => clearHandRaise(student.id)}
                                    style={styles.clearButton}
                                >
                                    <Text style={styles.clearButtonText}>Clear ✋</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

    // SeatBox component for seat grid
    import { Pressable } from "react-native";

    function SeatBox({ student, seatLabel }: { student?: StudentInfo; seatLabel: string }) {
        const [showName, setShowName] = useState(false);
        // Add mouse event handlers for web
        const handleMouseEnter = () => setShowName(true);
        const handleMouseLeave = () => setShowName(false);
        return (
            <Pressable
                style={styles.seatBox}
                onPressIn={() => setShowName(true)}
                onPressOut={() => setShowName(false)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {student ? (
                    student.avatarType === "photo" && student.avatarUri ? (
                        <Image source={{ uri: student.avatarUri }} style={styles.seatPhoto} />
                    ) : (
                        <Text style={styles.seatEmoji}>{student.emoji}</Text>
                    )
                ) : (
                    <Text style={styles.seatNumber}>{seatLabel}</Text>
                )}
                {/* Ping for raised hand */}
                {student && student.handRaised && (
                    <View style={styles.seatPing} />
                )}
                {student && showName && (
                    <View style={styles.seatNamePopup}>
                        <Text style={styles.seatNameText}>{student.name}</Text>
                    </View>
                )}
            </Pressable>
        );
    }
const styles = StyleSheet.create({
                seatGap: {
                    width: 48,
                    height: 48,
                },
            seatNamePopup: {
                position: 'absolute',
                bottom: 52,
                left: '50%',
                transform: [{ translateX: -40 }],
                backgroundColor: '#222',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                zIndex: 10,
                minWidth: 80,
                alignItems: 'center',
            },
            seatNameText: {
                color: '#fff',
                fontWeight: '700',
                fontSize: 14,
            },
        seatGridContainer: {
            marginVertical: 16,
            alignItems: 'center',
        },
        seatRow: {
            flexDirection: 'row',
            marginBottom: 8,
        },
        seatBox: {
            width: 48,
            height: 48,
            borderWidth: 2,
            borderColor: '#eee',
            borderRadius: 8,
            marginHorizontal: 4,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#fafafa',
            position: 'relative',
        },
        seatNumber: {
            color: '#bbb',
            fontWeight: '700',
            fontSize: 16,
        },
        seatPhoto: {
            width: 32,
            height: 32,
            borderRadius: 16,
        },
        seatEmoji: {
            fontSize: 24,
        },
        seatPing: {
            position: 'absolute',
            top: 4,
            right: 4,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: '#ff5252',
            borderWidth: 2,
            borderColor: '#fff',
            zIndex: 2,
        },
        raisedHandList: {
            marginTop: 16,
            paddingBottom: 24,
        },
        raisedHandItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 8,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: '#f0f0f0',
        },
        raisedHandPhoto: {
            width: 28,
            height: 28,
            borderRadius: 14,
        },
        raisedHandEmoji: {
            fontSize: 20,
        },
        raisedHandName: {
            fontWeight: '700',
            color: '#000',
            fontSize: 15,
        },
        raisedHandSeat: {
            color: '#666',
            fontSize: 13,
        },
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    roomTitle: {
        fontSize: 24,
        fontWeight: "900",
        color: "#000",
    },
    dashboardLabel: {
        fontSize: 14,
        color: "#666",
        fontWeight: "500",
    },
    leaveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#f5f5f5",
    },
    leaveText: {
        fontSize: 14,
        color: "#999",
        fontWeight: "600",
    },
    statsContainer: {
        flexDirection: "row",
        padding: 24,
        gap: 12,
    },
    statBox: {
        flex: 1,
        backgroundColor: "#f9f9f9",
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#eee",
    },
    statBoxActive: {
        backgroundColor: "#fff5f5",
        borderColor: "#feb2b2",
    },
    statValue: {
        fontSize: 28,
        fontWeight: "900",
        color: "#000",
    },
    statValueActive: {
        color: "#c53030",
    },
    statLabel: {
        fontSize: 12,
        color: "#666",
        fontWeight: "600",
        textTransform: "uppercase",
        marginTop: 4,
    },
    statLabelActive: {
        color: "#c53030",
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#bbb",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 40,
    },
    studentCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#f0f0f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    studentCardActive: {
        borderColor: "#feb2b2",
        backgroundColor: "#fffafa",
    },
    studentEmoji: {
        fontSize: 32,
    },
    studentPhoto: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    studentName: {
        fontSize: 16,
        fontWeight: "700",
        color: "#000",
    },
    seatBadge: {
        backgroundColor: "#f0f0f0",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    seatText: {
        fontSize: 10,
        fontWeight: "800",
        color: "#666",
    },
    studentDetail: {
        fontSize: 13,
        color: "#666",
        marginTop: 2,
    },
    clearButton: {
        backgroundColor: "#000",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    clearButtonText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 100,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        color: "#999",
        fontWeight: "500",
    },
});
