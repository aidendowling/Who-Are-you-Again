import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

interface ClassroomStatusCardProps {
  total: number;
  occupied: number;
  available: number;
  handRaised?: number;
  userRole?: "student" | "professor";
}

export default function ClassroomStatusCard({
  total,
  occupied,
  available,
  handRaised = 0,
  userRole = "student",
}: ClassroomStatusCardProps) {
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Classroom Status</Text>
        <Text style={styles.percentText}>{occupancyPct}% full</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${occupancyPct}%` }]} />
      </View>

      <View
        style={[
          styles.statsRow,
          userRole === "professor" && styles.statsRowProfessor,
        ]}
      >
        <View style={[styles.statCard, styles.totalCard]}>
          <Text style={styles.totalValue}>{total}</Text>
          <Text style={styles.statLabel}>Total Seats</Text>
        </View>

        <View style={styles.statPlain}>
          <Text style={[styles.statValue, styles.occupiedValue]}>{occupied}</Text>
          <Text style={styles.statLabel}>Occupied</Text>
        </View>

        <View style={styles.statPlain}>
          <Text style={[styles.statValue, styles.availableValue]}>{available}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>

        {userRole === "professor" && (
          <View style={styles.statPlain}>
            <Text style={[styles.statValue, styles.handRaisedValue]}>
              {handRaised}
            </Text>
            <Text style={styles.statLabel}>Hand Raised</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const serifFont = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FAFAF8",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#B9B9B4",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontFamily: serifFont,
    fontWeight: "700",
    color: "#111111",
  },
  percentText: {
    fontSize: 15,
    fontFamily: monoFont,
    color: "#7A7A7A",
    fontWeight: "600",
  },
  progressTrack: {
    width: "100%",
    height: 16,
    backgroundColor: "#DDDEE3",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 24,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#234777",
    borderRadius: 999,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
  },
  statsRowProfessor: {
    flexWrap: "wrap",
  },
  statCard: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    minWidth: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  totalCard: {
    backgroundColor: "#E6E6EA",
    flex: 1,
    maxWidth: 120,
  },
  statPlain: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  totalValue: {
    fontSize: 24,
    fontFamily: serifFont,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontFamily: serifFont,
    fontWeight: "700",
    marginBottom: 8,
  },
  occupiedValue: {
    color: "#234777",
  },
  availableValue: {
    color: "#4DAA70",
  },
  handRaisedValue: {
    color: "#D68839",
  },
  statLabel: {
    fontSize: 13,
    color: "#6B6B6B",
    textAlign: "center",
    lineHeight: 18,
  },
});