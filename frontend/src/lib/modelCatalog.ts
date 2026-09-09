import type { ModelDefinition } from "../types/workspace";

export const modelCatalog: ModelDefinition[] = [
  { id: 'ic-7408', label: '7408 AND IC', description: '4 AND gates · both inputs HIGH → HIGH · 5 V', url: `${import.meta.env?.BASE_URL ?? '/'}models/ic-7408-and.glb`, scale: 0.01, rotation: [0, 0, 0] },
  { id: 'ic-7432', label: '7432 OR IC', description: '4 OR gates · either input HIGH → HIGH · 5 V', url: `${import.meta.env?.BASE_URL ?? '/'}models/ic-7432-or.glb`, scale: 0.01, rotation: [0, 0, 0] },
  { id: 'ic-7404', label: '7404 NOT IC', description: '6 inverters · reverses HIGH and LOW · 5 V', url: `${import.meta.env?.BASE_URL ?? '/'}models/ic-7404-not.glb`, scale: 0.01, rotation: [0, 0, 0] },
  { id: 'resistor', label: 'Resistor', description: '330 Ω default · ¼ W · ±5%', url: `${import.meta.env?.BASE_URL ?? '/'}models/resistors.glb`, scale: 1, rotation: [Math.PI / 2, 0, 0] },
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
