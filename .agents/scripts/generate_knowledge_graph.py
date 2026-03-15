import os
import re
import json

def get_imports(file_path):
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Match static imports: from "..." or from '...'
            matches = re.findall(r'from\s+[\'"]([^\'"]+)[\'"]', content)
            imports.extend(matches)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
    return imports

def generate_graph(root_dir):
    nodes = []
    links = []
    
    # Files to process
    src_dir = os.path.join(root_dir, 'src')
    
    file_map = {} # path -> id
    
    # 1. Map Files (Current Implementation)
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js')):
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, root_dir)
                file_id = rel_path
                file_map[file_id] = {
                    "id": file_id,
                    "type": "file",
                    "status": "implemented"
                }
                nodes.append(file_map[file_id])

    # 2. Extract Dependencies
    for file_id in file_map:
        abs_path = os.path.join(root_dir, file_id)
        imports = get_imports(abs_path)
        
        for imp in imports:
            # Resolve relative imports
            if imp.startswith('.'):
                dir_name = os.path.dirname(file_id)
                resolved = os.path.normpath(os.path.join(dir_name, imp))
                
                # Check for common extensions if missing
                possible_paths = [resolved, resolved + '.tsx', resolved + '.ts', resolved + '.js', os.path.join(resolved, 'index.tsx')]
                found = False
                for p in possible_paths:
                    if p in file_map:
                        links.append({"source": file_id, "target": p, "type": "import"})
                        found = True
                        break
                if not found:
                     # Check if it's a folder with index
                     folder_index = os.path.join(resolved, 'index')
                     for p_folder in [folder_index + '.tsx', folder_index + '.ts', folder_index + '.js']:
                         if p_folder in file_map:
                             links.append({"source": file_id, "target": p_folder, "type": "import"})
                             break
            elif imp in ['firebase/firestore', 'firebase/auth', 'expo-camera', 'expo-image-picker']:
                # External dependencies
                ext_id = f"external:{imp}"
                if not any(n['id'] == ext_id for n in nodes):
                    nodes.append({"id": ext_id, "type": "external", "status": "third-party"})
                links.append({"source": file_id, "target": ext_id, "type": "dependency"})

    # 3. Add Planned Features (Vision)
    vision_nodes = [
        {"id": "vision:professor_dashboard", "type": "component", "status": "planned", "description": "Web interface for instructors"},
        {"id": "vision:nfc_checkin", "type": "feature", "status": "planned", "description": "NFC tag based identification"},
        {"id": "vision:hand_raise_alert", "type": "feature", "status": "planned", "description": "Real-time alerts for professor"}
    ]
    nodes.extend(vision_nodes)
    
    # Planned Links
    links.append({"source": "vision:professor_dashboard", "target": "external:firebase/firestore", "type": "dependency"})
    links.append({"source": "vision:professor_dashboard", "target": "vision:hand_raise_alert", "type": "includes"})

    return {"nodes": nodes, "links": links}

if __name__ == "__main__":
    # Determine the project root (assuming script is in .agents/scripts/)
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../../"))
    
    # Hardcoded fallback if needed
    if not os.path.exists(os.path.join(ROOT, 'src')):
         ROOT = "/Users/tianyima/Downloads/Who-Are-you-Again"
         
    OUTPUT = os.path.join(ROOT, ".agents/docs/knowledge_graph.json")
    
    graph_data = generate_graph(ROOT)
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, 'w') as f:
        json.dump(graph_data, f, indent=2)
    
    print(f"Knowledge graph generated at {os.path.abspath(OUTPUT)}")
