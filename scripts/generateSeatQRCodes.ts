#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { DEFAULT_LAYOUT, LayoutConfig } from "../shared/classroom";
import { DEFAULT_SEAT_QR_BASE_URL } from "../shared/seatQr";
import { writeSeatQrPackage } from "./seatQrExport";

interface CliOptions {
    roomId?: string;
    outputDir?: string;
    baseUrl: string;
    name: string;
    rows: number;
    seatsPerSection: number;
    sections: 1 | 2 | 3 | 4;
}

function printHelp() {
    console.log(`Generate seat QR SVGs, a printable HTML sheet, and a CSV manifest.

Usage:
  npm run generate:seat-qrs -- --roomId <roomId> [options]

Options:
  --roomId <id>            Required room id used in tag ids and output folder names
  --outputDir <path>       Output directory (default: generated/seat-qrs/<roomId>)
  --baseUrl <url>          QR check-in base URL (default: ${DEFAULT_SEAT_QR_BASE_URL})
  --name <layoutName>      Layout name (default: ${DEFAULT_LAYOUT.name})
  --rows <count>           Layout row count (default: ${DEFAULT_LAYOUT.rows})
  --seatsPerSection <n>    Seats per section (default: ${DEFAULT_LAYOUT.seatsPerSection})
  --sections <n>           Section count 1-4 (default: ${DEFAULT_LAYOUT.sections})
  --help                   Show this message
`);
}

function parseIntegerOption(name: string, value: string, min: number, max?: number) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < min || (max !== undefined && parsed > max)) {
        throw new Error(`${name} must be an integer between ${min} and ${max ?? "infinity"}.`);
    }
    return parsed;
}

function parseArgs(argv: string[]): CliOptions {
    const defaults: CliOptions = {
        baseUrl: DEFAULT_SEAT_QR_BASE_URL,
        name: DEFAULT_LAYOUT.name,
        rows: DEFAULT_LAYOUT.rows,
        seatsPerSection: DEFAULT_LAYOUT.seatsPerSection,
        sections: DEFAULT_LAYOUT.sections,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--help") {
            printHelp();
            process.exit(0);
        }

        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }

        const [flag, inlineValue] = token.split("=", 2);
        const nextToken = argv[index + 1];
        const value = inlineValue ?? nextToken;
        if (inlineValue === undefined) {
            if (!nextToken || nextToken.startsWith("--")) {
                throw new Error(`Missing value for ${flag}.`);
            }
            index += 1;
        }

        if (!value) {
            throw new Error(`Missing value for ${flag}.`);
        }

        switch (flag) {
        case "--roomId":
            defaults.roomId = value;
            break;
        case "--outputDir":
            defaults.outputDir = value;
            break;
        case "--baseUrl":
            defaults.baseUrl = value;
            break;
        case "--name":
            defaults.name = value;
            break;
        case "--rows":
            defaults.rows = parseIntegerOption("rows", value, 1);
            break;
        case "--seatsPerSection":
            defaults.seatsPerSection = parseIntegerOption("seatsPerSection", value, 1);
            break;
        case "--sections":
            defaults.sections = parseIntegerOption("sections", value, 1, 4) as 1 | 2 | 3 | 4;
            break;
        default:
            throw new Error(`Unknown option: ${flag}`);
        }
    }

    if (!defaults.roomId) {
        throw new Error("roomId is required.");
    }

    return defaults;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const roomId = options.roomId as string;
    const layout: LayoutConfig = {
        name: options.name,
        rows: options.rows,
        seatsPerSection: options.seatsPerSection,
        sections: options.sections,
    };
    const outputDir = options.outputDir
        ? path.resolve(options.outputDir)
        : path.resolve("generated", "seat-qrs", roomId);

    const result = await writeSeatQrPackage({
        roomId,
        layout,
        outputDir,
        baseUrl: options.baseUrl,
    });

    console.log(`Generated ${result.entries.length} seat QR codes for ${roomId}.`);
    console.log(`HTML sheet: ${result.htmlPath}`);
    console.log(`CSV manifest: ${result.manifestPath}`);
    console.log(`Teacher QR: ${result.teacherQrPath}`);
    console.log(`SVG directory: ${result.outputDir}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
