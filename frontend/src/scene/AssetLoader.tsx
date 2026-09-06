import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { modelCatalog } from "../lib/modelCatalog";
import { prepareModel, renderThumbnail } from "../lib/modelAssets";
import type { Workspace } from "../store/useWorkspace";
import type { LoadedAsset, ModelDefinition, ModelId } from "../types/workspace";

const thumbnails = new WeakMap<object, string>();

function LoadModel({
  model,
  attempt,
  onLoad,
}: {
  model: ModelDefinition;
  attempt: number;
  onLoad: (id: ModelId, asset: LoadedAsset) => void;
}) {
  const url = attempt ? `${model.url}?retry=${attempt}` : model.url;
  const { scene } = useGLTF(url);
  const renderer = useThree((state) => state.gl);
  const prepared = useMemo(() => prepareModel(scene, model), [scene, model]);
  useEffect(() => {
    let thumbnail = thumbnails.get(scene);
    if (thumbnail === undefined) {
      thumbnail = renderThumbnail(renderer, prepared.object, prepared.size);
      thumbnails.set(scene, thumbnail);
    }
    onLoad(model.id, { ...prepared, thumbnail });
  }, [model, onLoad, prepared, renderer, scene]);
  return null;
}

export function AssetLoader({ workspace }: { workspace: Workspace }) {
  return modelCatalog.map((model) => (
    <ErrorBoundary
      key={`${model.id}-${workspace.assets[model.id].attempt}`}
      fallback={null}
      onError={() => workspace.failed(model.id)}
    >
      <Suspense fallback={null}>
        <LoadModel
          model={model}
          attempt={workspace.assets[model.id].attempt}
          onLoad={workspace.loaded}
        />
      </Suspense>
    </ErrorBoundary>
  ));
}
