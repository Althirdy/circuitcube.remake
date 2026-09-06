import type { ModelDefinition } from "../types/workspace";

export const modelCatalog: ModelDefinition[] = [
  { id: 'breadboard-large', label: 'Full-Size Breadboard', description: '830 tie-point · split power rails', url: `${import.meta.env?.BASE_URL ?? '/'}models/breadboard-large.glb`, scale: 0.1, rotation: [0, 0, 0] },
  {
    id: "breadboard",
    label: "Breadboard",
    description: "400 tie-point · half-size",
    url: `${(import.meta.env?.BASE_URL ?? '/')}models/breadboard.glb`,
    scale: 0.1,
    rotation: [0, 0, 0],
  },
  {
    id: "power",
    label: "Bench DC Power Supply",
    description: "Switchable logical DC source",
    url: `${(import.meta.env?.BASE_URL ?? '/')}models/power.glb`,
    scale: 0.1,
    rotation: [0, 0, 0],
  },
  {
    id: "led",
    label: "LED",
    description: "5 mm · through-hole",
    url: `${(import.meta.env?.BASE_URL ?? '/')}models/led.glb`,
    scale: 0.1,
    rotation: [0, 0, 0],
  },
  { id: 'slide-switch', label: 'Slide Switch', description: 'SPDT · three breadboard pins', url: `${import.meta.env?.BASE_URL ?? '/'}models/slide-switch.glb`, scale: 1, rotation: [Math.PI / 2, 0, 0] },
];
export const modelLabel = (id: string) =>
  modelCatalog.find((model) => model.id === id)?.label ?? id;
