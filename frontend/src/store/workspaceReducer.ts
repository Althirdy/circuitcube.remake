import { createDemo } from "../lib/placement";
import type {
  Assets,
  ComponentInstance,
  LoadedAsset,
  ModelId,
  Layout,
  WireInstance,
} from "../types/workspace";

type State = {
  assets: Assets;
  instances: ComponentInstance[];
  wires: WireInstance[];
  initialized: boolean;
};
type Action =
  | { type: 'layout'; update: (layout: Layout) => Layout }
  | { type: "loaded"; id: ModelId; asset: LoadedAsset }
  | { type: "failed"; id: ModelId }
  | { type: "retry"; id: ModelId }
  | {
      type: "instances";
      update: (instances: ComponentInstance[]) => ComponentInstance[];
    };

export const initialWorkspace: State = {
  assets: {
    breadboard: { status: "loading", attempt: 0 },
    power: { status: "loading", attempt: 0 },
    led: { status: "loading", attempt: 0 },
  },
  instances: [],
  wires: [],
  initialized: false,
};

export function workspaceReducer(state: State, action: Action): State {
  if (action.type === 'layout') return { ...state, ...action.update(state) };
  if (action.type === "instances")
    return { ...state, instances: action.update(state.instances) };
  const attempt = state.assets[action.id].attempt;
  const assetState =
    action.type === "loaded"
      ? { status: "ready" as const, attempt, asset: action.asset }
      : action.type === "retry"
        ? { status: "loading" as const, attempt: attempt + 1 }
        : { status: "error" as const, attempt };
  const assets = { ...state.assets, [action.id]: assetState };
  if (
    !state.initialized &&
    Object.values(assets).every((asset) => asset.status !== "loading")
  ) {
    const board = assets.breadboard;
    const width =
      board.status === "ready"
        ? Math.max(board.asset.size.x, board.asset.size.z)
        : 0.084;
    return { assets, initialized: true, instances: createDemo(width), wires: [] };
  }
  return { ...state, assets };
}
