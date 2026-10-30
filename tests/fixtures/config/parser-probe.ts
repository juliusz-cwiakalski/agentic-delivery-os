import { readFileSync } from "node:fs";
import { parseConfigYaml } from "@delivery-os/adapters/file";

const file = process.argv[2];
if (!file) throw new Error("fixture path required");
const parsed = parseConfigYaml(readFileSync(file, "utf8"), "system", file);
process.stdout.write(`${JSON.stringify(parsed)}\n`);
