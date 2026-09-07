import type { Group, Vector3 } from "three";

export type BoardModelId = "breadboard" | "breadboard-large";
export type ModelId = BoardModelId | "power" | "led" | "slide-switch" | "resistor";
export type SocketSource = SocketDefinition[] | Record<BoardModelId, SocketDefinition[]>;
export type GroundPosition = [number, number];
export type Point3 = [number, number, number];
export type TerminalDefinition = {
  id: string;
  position: Point3;
  direction: Point3;
};
export type SocketDefinition = TerminalDefinition & {
  groupId: string;
  row?: string;
  column?: number;
};
export type TerminalRef = { componentId: string; terminalId: string };
export type LedMount = { breadboardId: string; anode: string; cathode: string };
export type SwitchMount = { breadboardId: string; pins: [string, string, string] };
export type ResistorMount = { breadboardId: string; pins: [string, string] };
export type WireColor = "black" | "red" | "blue" | "green" | "yellow" | "orange";
export type WireInstance = { id: string; from: TerminalRef; to: TerminalRef; color: WireColor; bends: Point3[]; height: number };
export type Layout = { instances: ComponentInstance[]; wires: WireInstance[] };
export type Selection = { kind: "component"; id: string } | { kind: "wire"; id: string } | { kind: "bend"; id: string; index: number } | null;
export type WireDraft = { from: TerminalRef; bends: Point3[]; preview: Point3 | null; target: TerminalRef | null; height: number };
export type InteractionMode =
  | { kind: "idle" }
  | { kind: "component-placement"; modelId: ModelId; flipped: boolean }
  | { kind: "component-mounting"; componentId: string }
  | { kind: "component-dragging"; componentId: string }
  | { kind: "wire-drawing"; draft: WireDraft }
  | { kind: "bend-editing"; wireId: string; index: number };
export type MountCandidate = { mount: LedMount | null; switchMount?: SwitchMount; resistorMount?: ResistorMount; valid: boolean; reason: string };
export type WireContextMenu = { x: number; y: number; wireId: string; point: Point3; insertIndex: number; bendIndex?: number };
export type ComponentInstance = {
  id: string;
  modelId: ModelId;
  position: GroundPosition;
  rotation: number;
  mount?: LedMount;
  switchMount?: SwitchMount;
  switchPosition?: 'left' | 'right';
  outputEnabled?: boolean;
  voltage?: number;
  resistanceOhms?: number;
  tolerancePercent?: number;
  powerRatingWatts?: number;
  resistorMount?: ResistorMount;
};
export type ModelDefinition = {
  id: ModelId;
  label: string;
  description: string;
  url: string;
  scale: number;
  rotation: [number, number, number];
};
export type LoadedAsset = { object: Group; size: Vector3; thumbnail: string; sockets?: SocketDefinition[]; terminals?: TerminalDefinition[]; ledBaseY?: number };
export type AssetState =
  | { status: "loading"; attempt: number }
  | { status: "ready"; attempt: number; asset: LoadedAsset }
  | { status: "error"; attempt: number };
export type Assets = Record<ModelId, AssetState>;
export type CameraAction =
  "home" | "top" | "front" | "fit" | "in" | "out" | "selection";
export type SceneApi = {
  command: (action: CameraAction) => void;
  viewCenter: () => GroundPosition;
};
