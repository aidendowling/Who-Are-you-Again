import { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Platform,
    Image,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Pressable,
    Alert,
    Dimensions,
    FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../config/firebase";
import {
    collection,
    doc,
    onSnapshot,
    updateDoc,
    writeBatch,
    getDocs,
    setDoc,
    deleteDoc,
    getDoc,
} from "firebase/firestore";
import { ensureAnonymousUid } from "../utils/auth";

// ─── Design tokens ────────────────────────────────────────────────────────────

const NAVY   = "#1e3a5f";
const ORANGE = "#e87d3e";
const GREEN  = "#4daa70";
const BLUE   = "#234777";

const serif = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const mono  = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

// ─── Zoom ─────────────────────────────────────────────────────────────────────

const ZOOM_STEPS  = [0.65, 0.85, 1.0];
const ZOOM_LABELS = ["65%", "85%", "100%"];
const BASE_SEAT   = 46;

// ─── Layout ───────────────────────────────────────────────────────────────────

interface LayoutConfig {
    id?: string;
    name: string;
    rows: number;
    seatsPerSection: number;
    sections: 1 | 2 | 3 | 4;
    createdBy?: string;
}

const DEFAULT_LAYOUT: LayoutConfig = {
    name: "New Layout",
    rows: 8,
    seatsPerSection: 6,
    sections: 2,
};

// ─── Layout helpers ───────────────────────────────────────────────────────────

function generateCols(count: number, offset = 0): string[] {
    return Array.from({ length: count }, (_, i) =>
        String.fromCharCode(65 + offset + i)
    );
}

function totalSeatsForLayout(layout: LayoutConfig): number {
    return layout.rows * layout.seatsPerSection * layout.sections;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckIn {
    id: string;
    name: string;
    seat: string;
    handRaised: boolean;
    checkedInAt: string;
    emoji: string;
    avatarType: string;
    avatarUri: string | null;
}

type SeatStatus = "available" | "occupied" | "hand-raised";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}min ago`;
    return `${Math.floor(mins / 60)}hr ago`;
}

// ─── SeatGrid ─────────────────────────────────────────────────────────────────

function SeatGrid({
    rows,
    cols,
    occupiedMap,
    seatSize,
    fontSize,
}: {
    rows: number[];
    cols: string[];
    occupiedMap: Map<string, CheckIn>;
    seatSize: number;
    fontSize: number;
}) {
    const radius = Math.round(seatSize * 0.18);
    return (
        <View style={{ flexDirection: "column", gap: 5 }}>
            {rows.map((row) => (
                <View key={row} style={{ flexDirection: "row", gap: 5 }}>
                    {cols.map((col) => {
                        const seatId = `${row}${col}`;
                        const checkin = occupiedMap.get(seatId);
                        const status: SeatStatus = !checkin
                            ? "available"
                            : checkin.handRaised
                            ? "hand-raised"
                            : "occupied";
                        return (
                            <View
                                key={seatId}
                                style={[
                                    seatSt.seat,
                                    { width: seatSize, height: seatSize, borderRadius: radius },
                                    status === "occupied"    && seatSt.occupied,
                                    status === "hand-raised" && seatSt.handRaised,
                                    status === "available"   && seatSt.available,
                                ]}
                            >
                                <Text
                                    style={[
                                        seatSt.label,
                                        { fontSize },
                                        status !== "available" && seatSt.labelLight,
                                    ]}
                                    numberOfLines={1}
                                >
                                    {seatId}
                                </Text>
                                {status === "hand-raised" && (
                                    <View style={seatSt.raisedBadge} />
                                )}
                            </View>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

// ─── MiniPreview ──────────────────────────────────────────────────────────────
// Tiny non-interactive grid used inside the editor to preview layout shape.

function MiniPreview({ layout }: { layout: LayoutConfig }) {
    const MINI = 6;
    const rows = Array.from({ length: layout.rows }, (_, i) => i + 1);
    const sectionCols = Array.from({ length: layout.sections }, (_, i) =>
        generateCols(layout.seatsPerSection, i * layout.seatsPerSection)
    );

    return (
        <View style={mini.wrap}>
            <View style={mini.podium} />
            <View style={{ flexDirection: "row", gap: 4 }}>
                {sectionCols.map((cols, si) => (
                    <View key={si} style={{ flexDirection: "row", gap: 4 }}>
                        {si > 0 && <View style={{ width: 4 }} />}
                        <View style={{ gap: 2 }}>
                            {rows.map(r => (
                                <View key={r} style={{ flexDirection: "row", gap: 2 }}>
                                    {cols.map(c => (
                                        <View key={c} style={[mini.seat, { width: MINI, height: MINI }]} />
                                    ))}
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ─── LayoutEditorSheet ────────────────────────────────────────────────────────

function LayoutEditorSheet({
    visible,
    current,
    roomId,
    onApply,
    onClose,
}: {
    visible: boolean;
    current: LayoutConfig;
    roomId: string;
    onApply: (layout: LayoutConfig) => void;
    onClose: () => void;
}) {
    const [tab, setTab]                   = useState<"edit" | "library">("edit");
    const [name, setName]                 = useState(current.name);
    const [rows, setRows]                 = useState(current.rows);
    const [seatsPerSection, setSeats]     = useState(current.seatsPerSection);
    const [sections, setSections]         = useState<1 | 2 | 3 | 4>(current.sections as 1 | 2 | 3 | 4);
    const [savedLayouts, setSavedLayouts] = useState<LayoutConfig[]>([]);
    const [saving, setSaving]             = useState(false);
    const [uid, setUid]                   = useState<string | null>(null);

    const draftLayout: LayoutConfig = { name, rows, seatsPerSection, sections };
    const SHEET_HEIGHT = Dimensions.get("window").height * 0.82;

    // Resolve uid and load library on open
    useEffect(() => {
        if (!visible) return;
        setTab("edit");
        setName(current.name);
        setRows(current.rows);
        setSeats(current.seatsPerSection);
        setSections(current.sections);

        (async () => {
            try {
                const resolvedUid = await ensureAnonymousUid();
                setUid(resolvedUid);
                await loadLibrary();
            } catch (e) {
                console.log("Could not load layout library:", e);
            }
        })();
    }, [visible]);

    const loadLibrary = async () => {
        const snap = await getDocs(collection(db, "layouts"));
        const list: LayoutConfig[] = [];
        snap.forEach((d) => {
            const data = d.data();
            list.push({
                id: d.id,
                name: data.name,
                rows: data.rows,
                seatsPerSection: data.seatsPerSection,
                sections: data.sections,
                createdBy: data.createdBy,
            });
        });
        setSavedLayouts(list.sort((a, b) => a.name.localeCompare(b.name)));
    };

    const saveToLibrary = async () => {
        if (!uid) return;
        if (!name.trim()) { Alert.alert("Name required", "Give this layout a name before saving."); return; }
        setSaving(true);
        try {
            const layoutDoc = doc(collection(db, "layouts"));
            await setDoc(layoutDoc, { name: name.trim(), rows, seatsPerSection, sections, createdBy: uid, createdAt: new Date().toISOString() });
            await loadLibrary();
            Alert.alert("Saved", `"${name.trim()}" added to the campus library.`);
        } catch (e) {
            console.log("Could not save layout:", e);
        }
        setSaving(false);
    };

    const deleteFromLibrary = async (layoutId: string) => {
        try {
            await deleteDoc(doc(db, "layouts", layoutId));
            await loadLibrary();
        } catch (e) {
            console.log("Could not delete layout:", e);
        }
    };

    const applyPreset = (preset: LayoutConfig) => {
        setName(preset.name);
        setRows(preset.rows);
        setSeats(preset.seatsPerSection);
        setSections(preset.sections);
    };

    const handleApply = async () => {
        // Save layout choice to room doc so it persists
        try {
            await setDoc(
                doc(db, "rooms", roomId),
                { layout: { name: draftLayout.name, rows, seatsPerSection, sections } },
                { merge: true }
            );
        } catch (e) {
            console.log("Could not persist room layout:", e);
        }
        onApply(draftLayout);
        onClose();
    };

    const Stepper = ({
        label,
        value,
        min,
        max,
        onChange,
    }: {
        label: string;
        value: number;
        min: number;
        max: number;
        onChange: (v: number) => void;
    }) => (
        <View style={ed.stepperRow}>
            <Text style={ed.stepperLabel}>{label}</Text>
            <View style={ed.stepperControls}>
                <TouchableOpacity
                    style={[ed.stepBtn, value <= min && ed.stepBtnDisabled]}
                    onPress={() => onChange(Math.max(min, value - 1))}
                    activeOpacity={0.7}
                    disabled={value <= min}
                >
                    <Text style={ed.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={ed.stepValue}>{value}</Text>
                <TouchableOpacity
                    style={[ed.stepBtn, value >= max && ed.stepBtnDisabled]}
                    onPress={() => onChange(Math.min(max, value + 1))}
                    activeOpacity={0.7}
                    disabled={value >= max}
                >
                    <Text style={ed.stepBtnText}>+</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={ed.backdrop} onPress={onClose} />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={ed.sheetWrap}
                pointerEvents="box-none"
            >
                <View style={[ed.sheet, { height: SHEET_HEIGHT }]}>
                    <View style={ed.handle} />

                    {/* Header */}
                    <View style={ed.header}>
                        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                            <Text style={ed.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={ed.headerTitle}>Classroom Layout</Text>
                        <TouchableOpacity onPress={handleApply} activeOpacity={0.7}>
                            <Text style={ed.applyText}>Apply</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab bar */}
                    <View style={ed.tabBar}>
                        <TouchableOpacity
                            style={[ed.tab, tab === "edit" && ed.tabActive]}
                            onPress={() => setTab("edit")}
                            activeOpacity={0.7}
                        >
                            <Text style={[ed.tabText, tab === "edit" && ed.tabTextActive]}>
                                Configure
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[ed.tab, tab === "library" && ed.tabActive]}
                            onPress={() => setTab("library")}
                            activeOpacity={0.7}
                        >
                            <Text style={[ed.tabText, tab === "library" && ed.tabTextActive]}>
                                Campus Library {savedLayouts.length > 0 ? `(${savedLayouts.length})` : ""}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {tab === "edit" ? (
                        <ScrollView
                            contentContainerStyle={ed.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Live preview */}
                            <Text style={ed.sectionLabel}>Preview</Text>
                            <View style={ed.previewBox}>
                                <MiniPreview layout={draftLayout} />
                                <View style={ed.previewStats}>
                                    <Text style={ed.previewStat}>
                                        {totalSeatsForLayout(draftLayout)} seats
                                    </Text>
                                    <Text style={ed.previewStat}>
                                        {rows} rows
                                    </Text>
                                    <Text style={ed.previewStat}>
                                        {sections} {sections === 1 ? "section" : "sections"}
                                    </Text>
                                </View>
                            </View>

                            {/* Steppers */}
                            <Text style={ed.sectionLabel}>Customise</Text>
                            <View style={ed.steppersCard}>
                                <Stepper
                                    label="Rows"
                                    value={rows}
                                    min={1}
                                    max={20}
                                    onChange={setRows}
                                />
                                <View style={ed.divider} />
                                <Stepper
                                    label="Seats per section"
                                    value={seatsPerSection}
                                    min={1}
                                    max={12}
                                    onChange={setSeats}
                                />
                                <View style={ed.divider} />
                                {/* Sections toggle */}
                                <View style={ed.stepperRow}>
                                    <Text style={ed.stepperLabel}>Sections</Text>
                                    <View style={ed.segmentedControl}>
                                        {([1, 2, 3, 4] as const).map((n) => (
                                            <TouchableOpacity
                                                key={n}
                                                style={[ed.segment, sections === n && ed.segmentActive]}
                                                onPress={() => setSections(n)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[ed.segmentText, sections === n && ed.segmentTextActive]}>
                                                    {n}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* Save to library */}
                            <Text style={ed.sectionLabel}>Save to Library</Text>
                            <View style={ed.saveRow}>
                                <TextInput
                                    style={ed.nameInput}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Layout name…"
                                    placeholderTextColor="#aaa"
                                    returnKeyType="done"
                                />
                                <TouchableOpacity
                                    style={[ed.saveBtn, saving && ed.saveBtnDisabled]}
                                    onPress={saveToLibrary}
                                    activeOpacity={0.7}
                                    disabled={saving}
                                >
                                    <Text style={ed.saveBtnText}>
                                        {saving ? "Saving…" : "Save"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    ) : (
                        /* Library tab */
                        <ScrollView
                            contentContainerStyle={ed.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {savedLayouts.length === 0 ? (
                                <View style={ed.emptyLibrary}>
                                    <Text style={ed.emptyLibraryIcon}>📐</Text>
                                    <Text style={ed.emptyLibraryTitle}>No campus layouts yet</Text>
                                    <Text style={ed.emptyLibraryBody}>
                                        Configure a layout and tap Save — it'll be shared with all professors on campus.
                                    </Text>
                                </View>
                            ) : (
                                savedLayouts.map((layout) => (
                                    <View key={layout.id} style={ed.libraryRow}>
                                        <MiniPreview layout={layout} />
                                        <View style={{ flex: 1, gap: 2 }}>
                                            <Text style={ed.libraryName}>{layout.name}</Text>
                                            <Text style={ed.librarySub}>
                                                {totalSeatsForLayout(layout)} seats ·{" "}
                                                {layout.rows} rows ·{" "}
                                                {layout.sections} {layout.sections === 1 ? "section" : "sections"}
                                            </Text>
                                        </View>
                                        <View style={ed.libraryActions}>
                                            <TouchableOpacity
                                                style={ed.loadBtn}
                                                activeOpacity={0.7}
                                                onPress={() => {
                                                    applyPreset(layout);
                                                    setTab("edit");
                                                }}
                                            >
                                                <Text style={ed.loadBtnText}>Load</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                onPress={() =>
                                                    Alert.alert(
                                                        "Delete layout",
                                                        `Remove "${layout.name}" from your library?`,
                                                        [
                                                            { text: "Cancel", style: "cancel" },
                                                            {
                                                                text: "Delete",
                                                                style: "destructive",
                                                                onPress: () =>
                                                                    deleteFromLibrary(layout.id!),
                                                            },
                                                        ]
                                                    )
                                                }
                                            >
                                                <Text style={ed.deleteText}>✕</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SeatingMapScreen() {
    const router  = useRouter();
    const { roomId } = useLocalSearchParams<{ roomId: string }>();

    const [checkins, setCheckins]       = useState<CheckIn[]>([]);
    const [zoomIdx, setZoomIdx]         = useState(1);
    const [editorOpen, setEditorOpen]   = useState(false);
    const [layout, setLayout]           = useState<LayoutConfig>(DEFAULT_LAYOUT);

    const zoom     = ZOOM_STEPS[zoomIdx];
    const seatSize = Math.round(BASE_SEAT * zoom);
    const fontSize = Math.max(9, Math.round(11 * zoom));

    // Derive column arrays from current layout
    const sectionCols = Array.from({ length: layout.sections }, (_, i) =>
        generateCols(layout.seatsPerSection, i * layout.seatsPerSection)
    );
    const rows = Array.from({ length: layout.rows }, (_, i) => i + 1);

    // Load room's saved layout on mount
    useEffect(() => {
        if (!roomId) return;
        (async () => {
            try {
                const roomSnap = await getDoc(doc(db, "rooms", roomId));
                if (roomSnap.exists()) {
                    const saved = roomSnap.data().layout;
                    if (saved && saved.rows && saved.seatsPerSection && saved.sections) {
                        setLayout(saved as LayoutConfig);
                    }
                }
            } catch (e) {
                console.log("Could not load room layout:", e);
            }
        })();
    }, [roomId]);

    // Live checkin listener
    useEffect(() => {
        if (!roomId) return;
        const ref = collection(db, "rooms", roomId, "checkins");
        return onSnapshot(ref, (snap) => {
            const list: CheckIn[] = [];
            snap.forEach((d) => {
                const data = d.data();
                list.push({
                    id: d.id,
                    name: data.name || "Anonymous",
                    seat: (data.seat || "").toUpperCase(),
                    handRaised: data.handRaised || false,
                    checkedInAt: data.checkedInAt || new Date().toISOString(),
                    emoji: data.emoji || "😊",
                    avatarType: data.avatarType || "emoji",
                    avatarUri: data.avatarUri || null,
                });
            });
            setCheckins(list);
        });
    }, [roomId]);

    // Seat lookup map
    const occupiedMap = new Map<string, CheckIn>();
    checkins.forEach((c) => { if (c.seat) occupiedMap.set(c.seat, c); });

    const totalSeats      = totalSeatsForLayout(layout);
    const occupied        = checkins.length;
    const available       = Math.max(totalSeats - occupied, 0);
    const handRaisedCount = checkins.filter((c) => c.handRaised).length;
    const occupancyPct    = totalSeats > 0 ? Math.round((occupied / totalSeats) * 100) : 0;
    const handRaisers     = checkins
        .filter((c) => c.handRaised)
        .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());

    const clearOne = async (id: string) => {
        if (!roomId) return;
        try {
            await updateDoc(doc(db, "rooms", roomId, "checkins", id), { handRaised: false });
        } catch (e) {
            console.log("Could not clear hand raise:", e);
        }
    };

    const dismissAll = async () => {
        if (!roomId) return;
        const batch = writeBatch(db);
        handRaisers.forEach((c) =>
            batch.update(doc(db, "rooms", roomId, "checkins", c.id), { handRaised: false })
        );
        try { await batch.commit(); } catch (e) { console.log("Could not dismiss all:", e); }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                        <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.pageTitle}>Interactive Seating Map</Text>
                </View>

                {/* ── Classroom Status ── */}
                <View style={styles.card}>
                    <View style={styles.statusHeaderRow}>
                        <Text style={styles.cardTitle}>Classroom Status</Text>
                        <Text style={styles.pctLabel}>{occupancyPct}% full</Text>
                    </View>
                    <View style={styles.progressTrack}>
                        <View
                            style={[styles.progressFill, { width: `${occupancyPct}%` as any }]}
                        />
                    </View>
                    <View style={styles.statsGrid}>
                        <View style={[styles.statCell, styles.statCellGray]}>
                            <Text style={[styles.statValue, { color: "#111" }]}>{totalSeats}</Text>
                            <Text style={styles.statLabel}>Total Seats</Text>
                        </View>
                        <View style={styles.statCell}>
                            <Text style={[styles.statValue, { color: BLUE }]}>{occupied}</Text>
                            <Text style={styles.statLabel}>Occupied</Text>
                        </View>
                        <View style={styles.statCell}>
                            <Text style={[styles.statValue, { color: GREEN }]}>{available}</Text>
                            <Text style={styles.statLabel}>Available</Text>
                        </View>
                        <View style={styles.statCell}>
                            <Text style={[styles.statValue, { color: ORANGE }]}>{handRaisedCount}</Text>
                            <Text style={styles.statLabel}>Hands Raised</Text>
                        </View>
                    </View>
                </View>

                {/* ── Classroom Layout ── */}
                <View style={styles.card}>
                    {/* Title row */}
                    <View style={styles.layoutHeaderRow}>
                        <View>
                            <Text style={styles.cardTitle}>Classroom Layout</Text>
                            <Text style={styles.layoutSubtitle}>{layout.name}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.editLayoutBtn}
                            activeOpacity={0.7}
                            onPress={() => setEditorOpen(true)}
                        >
                            <Text style={styles.editLayoutText}>Edit</Text>
                        </TouchableOpacity>
                    </View>
                    {/* Zoom row — separate from title for breathing room */}
                    <View style={styles.zoomRow}>
                        <TouchableOpacity
                            style={styles.zoomBtn}
                            activeOpacity={0.7}
                            onPress={() => setZoomIdx((i) => Math.max(i - 1, 0))}
                        >
                            <Text style={styles.zoomBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.zoomValue}>{ZOOM_LABELS[zoomIdx]}</Text>
                        <TouchableOpacity
                            style={styles.zoomBtn}
                            activeOpacity={0.7}
                            onPress={() =>
                                setZoomIdx((i) => Math.min(i + 1, ZOOM_STEPS.length - 1))
                            }
                        >
                            <Text style={styles.zoomBtnText}>+</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Legend */}
                    <View style={styles.legend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, styles.legendDotAvail]} />
                            <Text style={styles.legendText}>Available</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: NAVY }]} />
                            <Text style={styles.legendText}>Occupied</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
                            <Text style={styles.legendText}>Hand Raised</Text>
                        </View>
                    </View>

                    {/* Pannable seat map */}
                    <View style={styles.mapViewport}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            bounces={false}
                            nestedScrollEnabled
                        >
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                nestedScrollEnabled
                            >
                                <View style={styles.podiumRow}>
                                    <View style={styles.podium}>
                                        <Text style={styles.podiumText}>Podium</Text>
                                    </View>
                                </View>
                                <View style={styles.gridRow}>
                                    {sectionCols.map((cols, si) => (
                                        <View key={si} style={{ flexDirection: "row" }}>
                                            {si > 0 && <View style={styles.aisle} />}
                                            <SeatGrid
                                                rows={rows}
                                                cols={cols}
                                                occupiedMap={occupiedMap}
                                                seatSize={seatSize}
                                                fontSize={fontSize}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </ScrollView>
                    </View>
                </View>

                {/* ── Hand Raises ── */}
                <View style={[styles.card, { marginBottom: 32 }]}>
                    <View style={styles.handRaiseHeader}>
                        <View style={styles.handRaiseTitleRow}>
                            <Text style={styles.cardTitle}>Hand Raises</Text>
                            {handRaisedCount > 0 && (
                                <View style={styles.handRaiseBadge}>
                                    <Text style={styles.handRaiseBadgeText}>{handRaisedCount}</Text>
                                </View>
                            )}
                        </View>
                        {handRaisedCount > 0 && (
                            <TouchableOpacity onPress={dismissAll} activeOpacity={0.7}>
                                <Text style={styles.dismissAll}>Dismiss All</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {handRaisers.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No raised hands</Text>
                        </View>
                    ) : (
                        handRaisers.map((c, i) => (
                            <View
                                key={c.id}
                                style={[
                                    styles.handRaiseRow,
                                    i < handRaisers.length - 1 && styles.handRaiseRowBorder,
                                ]}
                            >
                                <View style={styles.avatarCircle}>
                                    {c.avatarType === "photo" && c.avatarUri ? (
                                        <Image source={{ uri: c.avatarUri }} style={styles.avatarImage} />
                                    ) : (
                                        <Text style={styles.avatarEmoji}>{c.emoji}</Text>
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.handRaiseName}>{c.name}</Text>
                                    <Text style={styles.handRaiseMeta}>
                                        Seat {c.seat} · {timeAgo(c.checkedInAt)}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => clearOne(c.id)}
                                    activeOpacity={0.7}
                                    style={styles.checkBtn}
                                >
                                    <Text style={styles.checkMark}>✓</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Layout Editor Sheet */}
            <LayoutEditorSheet
                visible={editorOpen}
                current={layout}
                roomId={roomId ?? ""}
                onApply={setLayout}
                onClose={() => setEditorOpen(false)}
            />
        </SafeAreaView>
    );
}

// ─── Seat styles ──────────────────────────────────────────────────────────────

const seatSt = StyleSheet.create({
    seat: {
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
    },
    available: {
        backgroundColor: "#f0f2f5",
        borderWidth: 1,
        borderColor: "#d8dce3",
    },
    occupied: { backgroundColor: NAVY },
    handRaised: { backgroundColor: ORANGE },
    label: {
        fontFamily: mono,
        color: "#555",
        fontWeight: "600",
    },
    labelLight: { color: "#fff" },
    raisedBadge: {
        position: "absolute",
        top: 3,
        right: 3,
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#fff",
    },
});

// ─── Mini-preview styles ──────────────────────────────────────────────────────

const mini = StyleSheet.create({
    wrap: { alignItems: "center", paddingVertical: 8 },
    podium: {
        width: 40,
        height: 6,
        backgroundColor: "#c0c8d4",
        borderRadius: 3,
        marginBottom: 6,
    },
    seat: {
        backgroundColor: NAVY,
        borderRadius: 1,
    },
});

// ─── Editor styles ────────────────────────────────────────────────────────────

const ed = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheetWrap: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
    },
    sheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#ddd",
        alignSelf: "center",
        marginTop: 10,
        marginBottom: 2,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "700",
        fontFamily: serif,
        color: "#111",
    },
    cancelText: { fontSize: 16, color: "#888", fontFamily: mono },
    applyText:  { fontSize: 16, color: NAVY, fontWeight: "700", fontFamily: mono },

    // Tab bar
    tabBar: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
        paddingHorizontal: 20,
    },
    tab: {
        paddingVertical: 12,
        paddingHorizontal: 4,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabActive: { borderBottomColor: NAVY },
    tabText: { fontSize: 14, fontFamily: mono, color: "#888" },
    tabTextActive: { color: NAVY, fontWeight: "700" },

    scrollContent: { padding: 20, paddingBottom: 32 },

    sectionLabel: {
        fontSize: 12,
        fontFamily: mono,
        color: "#999",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 10,
    },

    // Presets
    presetChip: {
        backgroundColor: "#f0f2f5",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: "center",
        minWidth: 110,
    },
    presetChipActive: { backgroundColor: NAVY },
    presetChipText: { fontSize: 14, fontFamily: serif, fontWeight: "700", color: "#333" },
    presetChipSub:  { fontSize: 11, fontFamily: mono, color: "#888", marginTop: 2 },
    presetChipTextActive: { color: "#fff" },

    // Preview box
    previewBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f7f8fa",
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        gap: 20,
    },
    previewStats: { gap: 4 },
    previewStat: { fontSize: 13, fontFamily: mono, color: "#555" },

    // Steppers
    steppersCard: {
        backgroundColor: "#f7f8fa",
        borderRadius: 14,
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    stepperRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
    },
    stepperLabel: { fontSize: 15, fontFamily: serif, color: "#222", fontWeight: "600" },
    stepperControls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    stepBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#e4e7ed",
        justifyContent: "center",
        alignItems: "center",
    },
    stepBtnDisabled: { opacity: 0.3 },
    stepBtnText: { fontSize: 20, fontWeight: "700", color: "#333", lineHeight: 24 },
    stepValue: { fontSize: 18, fontFamily: mono, fontWeight: "700", color: "#111", minWidth: 30, textAlign: "center" },
    divider: { height: 1, backgroundColor: "#e4e7ed", marginHorizontal: -16 },

    // Sections segmented control
    segmentedControl: {
        flexDirection: "row",
        backgroundColor: "#e4e7ed",
        borderRadius: 10,
        padding: 3,
    },
    segment: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
    },
    segmentActive: { backgroundColor: "#fff" },
    segmentText: { fontSize: 15, fontFamily: mono, color: "#888" },
    segmentTextActive: { color: NAVY, fontWeight: "700" },

    // Save row
    saveRow: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
    },
    nameInput: {
        flex: 1,
        backgroundColor: "#f7f8fa",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e4e7ed",
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        fontFamily: mono,
        color: "#222",
    },
    saveBtn: {
        backgroundColor: NAVY,
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: "#fff", fontFamily: mono, fontWeight: "700", fontSize: 15 },

    // Library
    emptyLibrary: {
        alignItems: "center",
        paddingVertical: 48,
        gap: 10,
    },
    emptyLibraryIcon: { fontSize: 40 },
    emptyLibraryTitle: { fontSize: 17, fontFamily: serif, fontWeight: "700", color: "#333" },
    emptyLibraryBody: { fontSize: 14, fontFamily: mono, color: "#999", textAlign: "center" },

    libraryRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f2f5",
    },
    libraryName: { fontSize: 15, fontFamily: serif, fontWeight: "700", color: "#111" },
    librarySub:  { fontSize: 12, fontFamily: mono, color: "#888" },
    libraryActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    loadBtn: {
        backgroundColor: NAVY,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    loadBtnText: { color: "#fff", fontSize: 13, fontFamily: mono, fontWeight: "700" },
    deleteText: { fontSize: 16, color: "#ccc", fontWeight: "700" },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f7f8fa" },
    scroll: { padding: 16 },

    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
        marginTop: 4,
    },
    backArrow: { fontSize: 22, color: NAVY, fontWeight: "700" },
    pageTitle: { fontSize: 22, fontWeight: "700", fontFamily: serif, color: "#111" },

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

    // Status card
    statusHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    cardTitle: { fontSize: 18, fontWeight: "700", fontFamily: serif, color: "#111" },
    pctLabel:  { fontSize: 14, fontFamily: mono, color: "#888" },
    progressTrack: {
        height: 12,
        backgroundColor: "#e4e7ed",
        borderRadius: 6,
        overflow: "hidden",
        marginBottom: 20,
    },
    progressFill: { height: "100%", backgroundColor: NAVY, borderRadius: 6 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    statCell: { flex: 1, minWidth: "40%", alignItems: "center", paddingVertical: 14 },
    statCellGray: { backgroundColor: "#eef0f4", borderRadius: 14 },
    statValue: { fontSize: 32, fontWeight: "700", fontFamily: serif, marginBottom: 4 },
    statLabel: { fontSize: 13, fontFamily: mono, color: "#777", textAlign: "center" },

    // Layout card
    layoutHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 4,
    },
    layoutSubtitle: { fontSize: 12, fontFamily: mono, color: "#999", marginTop: 2 },
    zoomRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#f0f2f5",
        borderRadius: 10,
        paddingHorizontal: 4,
        paddingVertical: 2,
        alignSelf: "flex-start",
        marginTop: 14,
        marginBottom: 14,
    },
    zoomBtn: { width: 28, height: 28, justifyContent: "center", alignItems: "center" },
    zoomBtnText: { fontSize: 18, fontWeight: "700", color: "#333" },
    zoomValue: { fontSize: 12, fontFamily: mono, color: "#444", minWidth: 36, textAlign: "center" },
    editLayoutBtn: {
        backgroundColor: NAVY,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    editLayoutText: { color: "#fff", fontSize: 13, fontFamily: mono, fontWeight: "700" },

    legend: { flexDirection: "row", gap: 14, marginBottom: 14, flexWrap: "wrap" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendDotAvail: { backgroundColor: "#f0f2f5", borderWidth: 1, borderColor: "#aaa" },
    legendText: { fontSize: 12, fontFamily: mono, color: "#555" },

    mapViewport: {
        height: 320,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#f7f8fa",
    },
    podiumRow: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 16 },
    podium: {
        backgroundColor: "#fff",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#d0d4db",
        paddingHorizontal: 28,
        paddingVertical: 7,
    },
    podiumText: { fontSize: 14, fontFamily: mono, color: "#555" },
    gridRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 16 },
    aisle: { width: 20 },

    // Hand raises
    handRaiseHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    handRaiseTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    handRaiseBadge: {
        backgroundColor: ORANGE,
        borderRadius: 10,
        minWidth: 22,
        height: 22,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 6,
    },
    handRaiseBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    dismissAll: { fontSize: 14, fontFamily: mono, color: "#888" },

    handRaiseRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
    },
    handRaiseRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f2f5" },
    avatarCircle: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: "#f0f2f5",
        justifyContent: "center", alignItems: "center", overflow: "hidden",
    },
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
    avatarEmoji: { fontSize: 22 },
    handRaiseName: { fontSize: 16, fontWeight: "700", fontFamily: serif, color: "#111", marginBottom: 2 },
    handRaiseMeta: { fontSize: 13, fontFamily: mono, color: "#888" },
    checkBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
    checkMark: { fontSize: 18, color: "#aaa", fontWeight: "700" },

    emptyState: { paddingVertical: 24, alignItems: "center" },
    emptyText: { fontSize: 15, fontFamily: mono, color: "#bbb" },
});
