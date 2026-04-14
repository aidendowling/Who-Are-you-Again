 ݁₊⊹. ݁ʚ hi ɞ. ⟡ ݁.⊹
 Let's build an app that helps everybody learn each other's names!
 WH0 R U AGA1N?? <3

# Who Are You Again? 🤔

> **A mobile app that helps classmates learn each other's names through QR codes and shared profiles.**

Students create a personal profile, scan a QR code at their desk to check into a classroom, and instantly see who's sitting around them — complete with names, majors, interests, and fun facts.

---

## Features

- **Profile Creation** — Choose an emoji avatar or upload a photo, fill in your name, major, year, interests, and a fun fact
- **QR Code Scanning** — Scan the QR code on your desk to check into a specific classroom and seat
- **Live Classroom Dashboard** — See all checked-in students in real-time, with their profiles and seat numbers
- **Raise Hand** — A fun animated button to virtually raise your hand (visible to the whole class)
- **Test Mode** — Skip scanning and use a test room for development

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **React Native** + **Expo SDK 52** | Cross-platform mobile framework |
| **Expo Router** | File-based navigation |
| **Firebase Firestore** | Real-time database for profiles & classroom data |
| **Firebase Auth** | Anonymous authentication |
| **Expo Camera** | QR code barcode scanning |
| **Expo Image Picker** | Profile photo upload from device library |
| **Expo Image Manipulator** | Image resizing/compression for Firestore storage |
| **React Native Reanimated** | Smooth animations (scan line, hand wobble, pulse effects) |
| **Expo Blur** | Glassmorphism blur effect on home button |

---

## Project Structure

```
Who-Are-you-Again/
├── src/
│   ├── app/                    # Expo Router routes (file-based navigation)
│   │   ├── _layout.tsx         # Root layout — Stack navigator, status bar config
│   │   ├── index.tsx           # "/" → renders HomeScreen
│   │   ├── profile.tsx         # "/profile" → renders ProfileScreen
│   │   ├── scanner.tsx         # "/scanner" → renders QRScannerScreen
│   │   └── classroom.tsx       # "/classroom" → renders ClassroomScreen
│   │
│   ├── screens/                # All screen components (business logic + UI)
│   │   ├── HomeScreen.tsx      # Landing page with animated "hi" button
│   │   ├── ProfileScreen.tsx   # Profile creation/editing form
│   │   ├── QRScannerScreen.tsx # QR code scanner with camera
│   │   └── ClassroomScreen.tsx # Live classroom dashboard
│   │
│   └── config/
│       └── firebase.ts         # Firebase initialization (reads from .env)
│
├── assets/                     # App icons and splash screen
├── .env                        # Firebase API keys (gitignored)
├── app.json                    # Expo app configuration
├── babel.config.js             # Babel config (Reanimated plugin)
├── metro.config.js             # Metro bundler config
├── global.css                  # NativeWind base styles
├── tailwind.config.js          # Tailwind/NativeWind config
└── package.json                # Dependencies and scripts
```

---

## Screen-by-Screen Breakdown

### 1. `HomeScreen.tsx` — Landing Page

The entry point of the app. Features:
- Circular animated text spelling "WHO ARE YOU AGAIN?" using individual rotated characters
- A glassmorphic "hi" button in the center with a pulsing glow overlay (Expo Blur + Reanimated)
- Tapping the button navigates to `/profile`

### 2. `ProfileScreen.tsx` — Profile Creation

A scrollable form where users build their profile. Features:
- **Avatar selection** — Two tabs:
  - *Preset icons*: Grid of 16 emoji options
  - *Upload photo*: Pick from device library, automatically resized to 200×200 and compressed to JPEG via `expo-image-manipulator`, stored as a base64 data URI
- **Form fields**: Name (required), major, year (pill selector), interests, fun fact
- **Live preview card** — Shows how your profile will look to classmates
- **Fixed footer button** — "Enter Class →" always visible at the bottom
- **Persistence** — Profile data saved to and loaded from Firestore (keyed by anonymous device ID)

### 3. `QRScannerScreen.tsx` — QR Code Scanner

Handles classroom check-in via QR codes. Features:
- **QR icon** — Custom-drawn QR code icon using nested Views
- **Camera scanner** — `CameraView` from `expo-camera` with barcode scanning, isolated in its own `QRCameraScanner` component for clean camera lifecycle management
- **Scan overlay** — Animated scan line with corner brackets
- **QR format**: `wh0ru://room/{roomId}/seat/{seatId}`
- **Test bypass** — "Skip — Use Test Room" button for development
- **Scanned result display** — Shows raw data for non-matching QR codes

### 4. `ClassroomScreen.tsx` — Classroom Dashboard

The main classroom view after check-in. Features:
- **Your profile card** — Shows your avatar, name, major, and seat number
- **Raise Hand button** — Animated wobble effect when active, updates Firestore in real-time
- **Status bar** — Shows "Hand raised" confirmation
- **Student list** — Real-time Firestore listener (`onSnapshot`) shows all students in the room with their avatars (emoji or photo), names, majors, interests, and seat numbers
- **Leave button** — Returns to the home screen

---

## Firebase Data Model

### `profiles/{deviceId}`
```json
{
  "name": "Alice",
  "major": "Computer Science",
  "year": "Junior",
  "interests": "AI, music, hiking",
  "funFact": "I can juggle",
  "emoji": "😊",
  "avatarType": "photo",
  "avatarUri": "data:image/jpeg;base64,..."
}
```

### `rooms/{roomId}/students/{deviceId}`
```json
{
  "name": "Alice",
  "emoji": "😊",
  "avatarType": "photo",
  "avatarUri": "data:image/jpeg;base64,...",
  "major": "Computer Science",
  "year": "Junior",
  "interests": "AI, music, hiking",
  "funFact": "I can juggle",
  "seat": "A3",
  "handRaised": false,
  "joinedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## Navigation Flow

```
Home (/) → Profile (/profile) → Scanner (/scanner) → Classroom (/classroom?roomId=...&seat=...)
```

---

## Getting Started

### Prerequisites
- **Node.js** 18+
- **Expo Go** app on your iOS/Android device, or an iOS Simulator via Xcode

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/aidendowling/Who-Are-you-Again.git
   cd Who-Are-you-Again
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the project root with your Firebase config:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. **Start the development server**
   ```bash
   npx expo start
   ```

5. **Run the app**
   - Press `i` to open in iOS Simulator
   - Press `a` to open in Android Simulator
   - Press `w` to open in web browser

### ⚡ Local Development (Testing & Backend)

For full functionality (like joining rooms and profile persistence) without deploying to production, use the Firebase Emulators:

1. **Build Cloud Functions** (required if you change function code):
   ```bash
   npm --prefix functions run build
   ```

2. **Start Emulators**:
   In a separate terminal, run:
   ```bash
   npm run emulators
   ```

3. **Configure App to use Emulators**:
   Ensure `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1` is set in your `.env`.
   and `EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-wh0ru-aga1n`

4. **Restart Expo with Clear Cache** (if you just changed `.env`):
   ```bash
   npx expo start -c
   ```

5. **Use Test Room**:
   In the scanner screen, tap **"Skip — Use Test Room"**. This will automatically seed a mock classroom in your local emulator.

---

## Testing

The repo now has a layered test harness instead of relying on manual Expo tapping:

- `npm run typecheck` — app + Cloud Functions TypeScript validation
- `npm run test:domain` — pure classroom/seat/proximity domain tests
- `npm run test:app` — app smoke tests for scanner, classroom, and nearby flows
- `npm run test:firebase` — Firebase Auth/Firestore/Functions emulator integration tests
- `npm run test:ci` — full verification gate used by CI

### Local Emulator Notes

- Install root dependencies with `npm install`
- Install function dependencies with `npm --prefix functions install`
- Use `npm run emulators` to inspect the Firebase emulator stack manually
- The test-room bypass is only available in development or when `EXPO_PUBLIC_ENABLE_TEST_SUPPORT=1`
- To point the Expo app at emulators, set `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`


---

### Setting Up Android Studio for Expo (Windows)

To test the app on an Android Emulator, follow these steps to configure your development environment:

#### 1. Install Android Studio

- Download and install **Android Studio** from [developer.android.com](https://developer.android.com).
- During installation, make sure the following are checked (usually enabled by default):
  - **Android SDK**
  - **Android SDK Platform**
  - **Android Virtual Device**

#### 2. Configure SDK Manager

- Open Android Studio and go to **SDK Manager**.
- Ensure **Android 13.0 (API 33)** or higher is installed as your SDK platform.

#### 3. Set Environment Variables

Set the following environment variables so React Native can locate the Android SDK:

| Variable         | Value                                                      |
| :--------------- | :--------------------------------------------------------- |
| `ANDROID_HOME`   | `C:\Users\<YourUsername>\AppData\Local\Android\Sdk`    |

> **Note:** Replace `<YourUsername>` with your actual Windows account name.

Add these entries to your system **PATH** variable:

- `%ANDROID_HOME%\emulator`
- `%ANDROID_HOME%\platform-tools`

#### 4. Verify Installation

Restart your terminal and run:

```bash
adb --version
```

If it returns a version number, your environment is correctly configured for Expo.

### Setting Up Android Studio for Expo (macOS)

To test the app on an Android Emulator on macOS, follow these steps:

#### 1. Install Android Studio

- Download and install **Android Studio** from [developer.android.com](https://developer.android.com) or via Homebrew:

```bash
brew install --cask android-studio
```
- During installation, ensure these components are installed:
   - **Android SDK**
   - **Android SDK Platform**
   - **Android Virtual Device**

#### 2. Configure SDK Manager

- Open Android Studio → **Preferences** → **Appearance & Behavior** → **System Settings** → **Android SDK**.
- Ensure **Android 13.0 (API 33)** or higher is installed.

#### 3. Set Environment Variables

Add the Android SDK location to your shell configuration so tooling can find it. Most macOS installs use `~/Library/Android/sdk`.

Add the following to your shell profile (`~/.zshrc`, `~/.zprofile`, or `~/.bash_profile`):

```bash
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export PATH="$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:$PATH"
```

Apply the changes with `source ~/.zshrc` (or the file for your shell).

#### 4. Verify Installation

Restart your terminal and run:

```bash
adb --version
```

If it returns a version number, your environment is correctly configured for Expo on macOS.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Expo dev server |
| `npm run ios` | Start with iOS |
| `npm run android` | Start with Android |
| `npm run web` | Start with web |

---

All Firebase config is loaded from `.env` via Expo's built-in `EXPO_PUBLIC_` prefix support.

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_FIREBASE_*` | Standard Firebase configuration keys |
| `EXPO_PUBLIC_USE_FIREBASE_EMULATORS` | Set to `1` to use local emulators (Auth/Firestore/Functions) |
| `EXPO_PUBLIC_ENABLE_TEST_SUPPORT` | Set to `1` to enable the "Test Room" bypass in builds |

> **Note:** If you change these variables, restart Expo with `npx expo start -c` to clear the bundler cache.

---

## Known Limitations

- **Profile photos** are stored as base64 in Firestore (limited to ~500KB per image). For a production app, use Firebase Storage instead.
- **Authentication** is anonymous — profiles are keyed by `Constants.installationId`, which is unique per device/install but doesn't persist across app reinstalls.
- **Camera on iOS Simulator** — The simulated camera may show a persistent camera indicator even after stopping the scanner, as the simulator doesn't have real camera hardware to release.
