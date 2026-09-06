import { modelCatalog } from '../lib/modelCatalog';
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
  assets: Object.fromEntries(modelCatalog.map(model => [model.id, { status: "loading", attempt: 0 }])) as Assets,
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
    const board = assets['breadboard-large'];
    const width =
      board.status === "ready"
        ? Math.max(board.asset.size.x, board.asset.size.z)
        : 0.165;
    return { assets, initialized: true, instances: createDemo(width, assets.power.status === 'ready' ? assets.power.asset.size.x : 0.2, assets.led.status === 'ready' ? assets.led.asset.size.x : 0.0058), wires: [] };
  }
  return { ...state, assets };
}
