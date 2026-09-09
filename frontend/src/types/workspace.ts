import type { Group, Vector3 } from "three";

export type BoardModelId = "breadboard" | "breadboard-large";
export type LogicIcModelId = 'ic-7408' | 'ic-7432' | 'ic-7404';
export type ModelId = BoardModelId | "power" | "led" | "slide-switch" | "resistor" | LogicIcModelId;
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
export type IcPins = [string, string, string, string, string, string, string, string, string, string, string, string, string, string];
export type IcMount = { breadboardId: string; pins: IcPins };
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
type CandidateState = { valid: boolean; reason: string };
export type MountCandidate = CandidateState & (
  | { kind: 'led'; mount: LedMount | null; switchMount?: never; resistorMount?: never; icMount?: never }
  | { kind: 'switch'; mount: null; switchMount: SwitchMount; resistorMount?: never; icMount?: never }
  | { kind: 'resistor'; mount: null; resistorMount: ResistorMount; switchMount?: never; icMount?: never }
  | { kind: 'ic'; mount: null; icMount: IcMount; switchMount?: never; resistorMount?: never }
  | { kind: 'invalid'; mount: null; icMount?: never; switchMount?: never; resistorMount?: never }
);
export type WireContextMenu = { x: number; y: number; wireId: string; point: Point3; insertIndex: number; bendIndex?: number };
type BaseComponent = {
  id: string;
  position: GroundPosition;
  rotation: number;
};
type LegacyComponentFields = {
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
// Keep the existing DC component contract during the incremental migration.
// ICs cannot carry unrelated DC/switch fields, even though shared readers may
// still inspect those fields without narrowing a legacy component.
export type LogicIcInstance = BaseComponent & {
  modelId: LogicIcModelId;
  icMount?: IcMount;
} & { [K in keyof LegacyComponentFields]?: undefined };
export type ComponentInstance = LogicIcInstance | (BaseComponent & LegacyComponentFields & {
  modelId: Exclude<ModelId, LogicIcModelId>;
  icMount?: undefined;
});
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
