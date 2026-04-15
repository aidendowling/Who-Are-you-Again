const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env.production");

if (!fs.existsSync(envPath)) {
    console.error("Missing .env.production");
    console.error("Create .env.production from .env.production.example before deploying.");
    process.exit(1);
}

function parseEnv(raw) {
    const vars = {};
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;

        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        vars[key] = value;
    }
    return vars;
}

const fileVars = parseEnv(fs.readFileSync(envPath, "utf8"));
const env = {
    ...process.env,
    ...fileVars,
    EXPO_PUBLIC_USE_FIREBASE_EMULATORS: "0",
};

const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["expo", "export", "--platform", "web"],
    {
        cwd: rootDir,
        env,
        stdio: "inherit",
    }
);

if (typeof result.status === "number") {
    process.exit(result.status);
}

process.exit(1);
