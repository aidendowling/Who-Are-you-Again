# Firestore Setup for Multi-Device Classroom

This document explains how to deploy the Firestore security rules and enable the multi-device classroom to work online.

## Security Rules Overview

The `firestore.rules` file contains rules that allow:

1. **Anonymous/Authenticated Users** (Students):
   - Can read their own user profile
   - Can write/create their own check-in record
   - Can update their own hand-raised flag
   - Can read all check-ins in a room (for live updates from other students)

2. **Professor Dashboard**:
   - Can read all student check-ins in real-time
   - Can monitor hand raises and seat assignments
   - Uses Firestore's `onSnapshot` for live updates

## How to Deploy

### Option 1: Using Firebase CLI (Recommended for Production)

```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy rules and indexes to your Firebase project
firebase deploy --only firestore:rules,firestore:indexes
```

### Option 2: Deploy via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules` into the rules editor
5. Click **Publish**

## What the Rules Allow

### Student Check-in Flow

```
Student enters seat number
  ↓
App writes to: rooms/{roomId}/checkins/{userId}
  - name, seat, emoji, avatarType, avatarUri, major, year, interests, handRaised, checkedInAt
  ↓
Professor's app listens to the same collection
  ↓
Professor sees real-time updates (via onSnapshot)
```

### Security Features

- ✅ Users can only modify their own check-in record
- ✅ Users cannot modify other students' data
- ✅ Professor can see all check-ins in their room
- ✅ Hand raise flag can be toggled by the student
- ✅ Anonymous authentication is supported

## Testing the Rules

To test the rules locally:

```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# Run tests
npm test
```

## Environment Variables

Make sure your app has the correct Firebase configuration:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Troubleshooting

### "Permission denied" errors

- Make sure you've deployed the rules (see "Deploy via Firebase CLI" above)
- Check that `firebaseAuth` is initialized for anonymous users
- Verify the rule paths match your data structure

### Real-time updates not working

- Confirm students are authenticated (anonymous auth)
- Check that the professor's `onSnapshot` listener is properly set up
- Look for Firestore errors in the browser console

## Data Structure

The app expects this Firestore structure:

```
firestore
├── users/{userId}
│   ├── name
│   ├── emoji
│   ├── avatarType
│   ├── avatarUri
│   ├── userType (student | professor)
│   └── ...profile fields
│
└── rooms/{roomId}
    └── checkins/{userId}
        ├── name
        ├── seat (e.g., "A1", "B5")
        ├── emoji
        ├── avatarType
        ├── avatarUri
        ├── major
        ├── year
        ├── interests
        ├── handRaised (boolean)
        └── checkedInAt (timestamp)
```

## Questions?

If the app isn't working after deployment, check:
1. ✅ Rules are published
2. ✅ Anonymous auth is enabled in Firebase Console
3. ✅ Environment variables are correct
4. ✅ Firestore database is in "production mode" not "test mode"
