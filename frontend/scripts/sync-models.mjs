import { copyFile, mkdir } from "node:fs/promises";

const source = new URL("../../models/", import.meta.url);
const destination = new URL("../public/models/", import.meta.url);
await mkdir(destination, { recursive: true });
const filenames = ["breadboard.glb", "breadboard-large.glb", "power.glb", "led.glb", "slide-switch.glb", "resistors.glb"];
for (const filename of filenames) {
  await copyFile(new URL(filename, source), new URL(filename, destination));
}
console.log(`Synced ${filenames.length} CircuitCube models.`);
