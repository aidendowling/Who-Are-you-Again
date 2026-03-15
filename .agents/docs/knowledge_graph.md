# Project Knowledge Graph

This project uses a dynamic knowledge graph generated via a Python script. This ensures the map stays up-to-date as the codebase evolves.

## 📊 Dynamic Knowledge Graph (JSON)
The primary data source for the project's knowledge graph is:
`/.agents/docs/knowledge_graph.json`

This file is structured for programmatic use by AI agents and contains:
- **Nodes**: Files (implemented), Vision components (planned), and External modules.
- **Links**: Imports, dependencies, and logical relations.

### How to Update
To regenerate the knowledge graph after code changes, run the following script from the project root:

```bash
python3 .agents/scripts/generate_knowledge_graph.py
```

---

## 🗺️ Visual Overview (Mermaid)
Below is a static visual representation of the current core architecture for quick reference.

### File Dependency Graph (Imports)

```mermaid
graph TD
    subgraph App_Routes [App Routes]
        index["src/app/index.tsx"]
        profile_route["src/app/profile.tsx"]
        scanner_route["src/app/scanner.tsx"]
        classroom_route["src/app/classroom.tsx"]
        layout["src/app/_layout.tsx"]
    end

    subgraph Screens [Screens]
        HomeScreen["screens/HomeScreen.tsx"]
        ProfileScreen["screens/ProfileScreen.tsx"]
        QRScannerScreen["screens/QRScannerScreen.tsx"]
        ClassroomScreen["screens/ClassroomScreen.tsx"]
    end

    subgraph Config [Config]
        firebase["config/firebase.ts"]
    end

    %% Internal Dependencies
    index --> HomeScreen
    profile_route --> ProfileScreen
    scanner_route --> QRScannerScreen
    classroom_route --> ClassroomScreen

    ProfileScreen --> firebase
    QRScannerScreen --> firebase
    ClassroomScreen --> firebase

    %% External Dependencies (Key)
    QRScannerScreen -- "expo-camera" --> Camera["Camera Hardware"]
    ProfileScreen -- "expo-image-picker" --> ImagePicker["Media Library"]
    ClassroomScreen -- "firebase/firestore" --> Firestore[("Cloud Firestore")]
```

## 🚀 Full Project Vision (Planned)

```mermaid
graph LR
    subgraph Current
        StudentApp["Student App"]
    end
    
    subgraph Planned
        ProfDashboard["Professor Dashboard (Web)"]
        NFC["NFC Check-in"]
        HandRaise["Hand Raise Notifications"]
    end
    
    StudentApp -- "Real-time Update" --> ProfDashboard
    NFC -- "Alternative to" --> StudentApp
    StudentApp -- "Triggers" --> HandRaise
```
