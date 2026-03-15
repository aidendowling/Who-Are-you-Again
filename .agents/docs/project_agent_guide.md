# AI Agent Guide: Who Are You Again? (Synapse)

This document serves as a comprehensive technical guide for AI agents to understand, navigate, and contribute to the "Who Are You Again?" (Synapse) project.

## Project Overview
**Goal**: A mobile application to facilitate name association and social interaction in large classrooms using discrete interaction models (QR codes).
**Key Concept**: "Bridging Physical Presence and Digital Identity" without intrusive tracking.

## Technical Stack
- **Framework**: React Native with Expo SDK 52.
- **Navigation**: Expo Router (File-based).
- **Styling**: NativeWind (Tailwind CSS for React Native).
- **Hardware Integrations**: 
  - **Implemented**: Expo Camera (QR Scanning), Expo Image Picker/Manipulator (Profile Photos).
  - **Proposed**: NFC integration (alternate check-in method).
- **Proposed Components**: Professor's Dashboard (web/mobile interface for real-time class mapping).

## Architecture & Code Structure

### Directories
- `/src/app/`: Expo Router routes. Thin wrappers around screen components.
- `/src/screens/`: Main business logic and UI components.
- `/src/config/`: Configuration files (Firebase).
- `/assets/`: Static assets (icons, splash screen).
- `/.agents/`: Documentation and scripts for AI agents.

### Navigation Flow (Current + Planned)
1. **Home** (`/`): Landing page.
2. **Profile** (`/profile`): User setup.
3. **Scanner** (`/scanner`): QR/NFC check-in.
4. **Classroom** (`/classroom`): Student dashboard.
5. **[Planned] Professor View**: A specialized dashboard to view the room layout, student profiles, and hand-raise alerts.

## Data Models (Firestore)

### Users Collection (`users/{deviceId}`)
Stores persistent user profile data.
```typescript
{
  name: string;
  major: string;
  year: string;
  interests: string;
  funFact: string;
  emoji: string;
  avatarType: "emoji" | "photo";
  avatarUri: string | null; // Base64 data URI for photos
  updatedAt: string; // ISO string
}
```

### Rooms Collection (`rooms/{roomId}/checkins/{deviceId}`)
Stores temporary check-in data for a specific classroom.
```typescript
{
  name: string;
  emoji: string;
  avatarType: string;
  avatarUri: string | null;
  major: string;
  year: string;
  interests: string;
  seat: string;
  handRaised: boolean;
  checkedInAt: string; // ISO string
}
```

## Key Components & Patterns

### Animations
- **CircularText** (`HomeScreen.tsx`): Rotating text using `useAnimatedStyle`.
- **ScanningOverlay** (`QRScannerScreen.tsx`): Animated scan line.
- **RaiseHandButton** (`ClassroomScreen.tsx`): Wobble effect on active state.

### Image Handling
- Images are resized to 200x200 and compressed to JPEG base64 strings before being stored in Firestore.
- **Note**: This is a limited approach for prototypes. Productioin should use Firebase Storage.

### Real-time Updates
- `ClassroomScreen.tsx` uses `onSnapshot` from Firestore to listen for real-time changes in the room's `checkins` collection.

## Developmental Constraints (AI Context)
- **Firebase Keys**: Read from `.env` via `EXPO_PUBLIC_` prefix.
- **Test Mode**: `QRScannerScreen.tsx` includes a bypass to a "test-room" for development.
- **Simulators**: QR scanning requires physical hardware or specific simulator mocks.
- **User Identity**: Currently hardcoded to `test-user-001` in many places. Moving to proper Anonymous Auth should be a priority.

## Feature Vision (Roadmap)

### Phase 2: Core Interaction
- [x] Anonymous Authentication.
- [x] QR Code check-in & seat selection logic.
- [x] Basic room dashboard layout.
- [ ] Question request button (student side).
- [ ] Question notification logic (professor side).

### Phase 3: Real-time & Verification
- [x] Real-time updates via Firestore `onSnapshot`.
- [ ] Live updating seat map visualization.
- [ ] Initial user testing with classmates.

### Phase 4: Refinement
- [ ] NFC tag integration for seamless check-in.
- [ ] Visual cues for question requests on a central display.
- [ ] Final UI/UX polish and stress testing.

## Technical Vision: "Less is More"
The project avoids invasive technology (facial recognition, GPS tracking) in favor of **discrete interaction models**. The goal is a **distributed user interface** where identity is contextually linked to physical location (seats) via QR/NFC, creating a localized social network.
