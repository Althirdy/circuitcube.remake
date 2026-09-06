import { copyFile, mkdir } from "node:fs/promises";

const source = new URL("../../models/", import.meta.url);
const destination = new URL("../public/models/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const filename of ["breadboard.glb", "power.glb", "led.glb"]) {
  await copyFile(new URL(filename, source), new URL(filename, destination));
}
console.log("Synced 3 CircuitCube models.");
