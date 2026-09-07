import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import type { OrbitControls } from "three-stdlib";
import { ModelInstance } from "../components/3d/ModelInstance";
import { ErrorBoundary } from "../components/ErrorBoundary";
import type { Workspace } from "../store/useWorkspace";
import { AssetLoader } from "./AssetLoader";
import { CameraRig } from "./CameraRig";
import { useSceneInteraction } from "./useSceneInteraction";
import { ElectricalWarnings } from '../components/3d/ElectricalWarnings';
import { Connections, SocketFeedback } from '../components/3d/Connections';

function Contents({ workspace }: { workspace: Workspace }) {
  const controls = useRef<OrbitControls | null>(null);
  const feedback = useSceneInteraction(workspace, controls);
  const preview = workspace.placing || workspace.mode.kind === 'component-mounting' ? feedback.preview : null;
  const placementAsset = preview
    ? workspace.assets[preview.modelId]
    : null;
  return (
    <>
      <color attach="background" args={["#f3f6f9"]} />
      <ambientLight intensity={1.8} />
      <hemisphereLight args={["#eaf2ff", "#a8adb6", 1]} />
      <directionalLight position={[1, 2, 3]} intensity={3} />
      <directionalLight
        position={[-2, 1, -1]}
        intensity={1.5}
        color="#d7e6ff"
      />
      <AssetLoader workspace={workspace} />
      <Grid
        position={[0, -0.00004, 0]}
        args={[workspace.width * 100, workspace.width * 100]}
        cellSize={workspace.spacing}
        cellThickness={0.65}
        cellColor="#cbd5df"
        sectionSize={workspace.spacing * 10}
        sectionThickness={1}
        sectionColor="#9aaec0"
        fadeDistance={workspace.width * 24}
        fadeStrength={1.6}
        infiniteGrid
        followCamera
      />
      <group name="placed-components">
        {workspace.instances.map((instance) => {
          if (workspace.mode.kind === 'component-mounting' && feedback.hiddenId === instance.id) return null;
          const state = workspace.assets[instance.modelId];
          return state.status === "ready" ? (
            <group key={instance.id} userData={{ instanceId: instance.id }}>
              <ModelInstance
                instance={instance}
                asset={state.asset}
                selected={workspace.selectedId === instance.id}
                instances={workspace.instances}
                sockets={workspace.sockets}
                brightness={workspace.power.components[instance.id]?.brightness ?? 0}
                powered={instance.modelId === 'power' ? workspace.power.supplies[instance.id] === 'on' : workspace.power.leds[instance.id] === 'on'}
              />
            </group>
          ) : null;
        })}
      </group>
      <Connections workspace={workspace} />
      <ElectricalWarnings workspace={workspace} />
      <SocketFeedback workspace={workspace} hoverSwitch={feedback.hoverSwitch} hover={feedback.hover} candidate={preview ? feedback.candidate : null} />
      {preview && placementAsset?.status === "ready" && (
        <ModelInstance
          preview
          asset={placementAsset.asset}
          instance={preview}
          instances={workspace.instances}
          sockets={workspace.sockets}
          invalid={!!feedback.candidate && !feedback.candidate.valid}
        />
      )}
      <CameraRig workspace={workspace} controls={controls} />
    </>
  );
}

function Unavailable() {
  return (
    <div className="canvas-fallback" role="alert">
      <h2>3D view unavailable</h2>
      <p>
        This workspace needs WebGL. Enable hardware acceleration in your
        browser, then reload.
      </p>
      <button onClick={() => window.location.reload()}>Reload workspace</button>
    </div>
  );
}

export function CircuitScene({ workspace }: { workspace: Workspace }) {
  const [contextLost, setContextLost] = useState(() => {
    // Renderer construction can reject asynchronously, outside React boundaries.
    // Check availability first so unsupported browsers get an immediate fallback.
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      if (!context) return true;
      context.getExtension("WEBGL_lose_context")?.loseContext();
      return false;
    } catch {
      return true;
    }
  });
  return (
    <ErrorBoundary fallback={<Unavailable />}>
      {contextLost ? (
        <Unavailable />
      ) : (
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{
            position: [0.2, 0.3, 0.4],
            fov: 38,
            near: 0.00001,
            far: 100,
          }}
          gl={{ antialias: true }}
          fallback={<Unavailable />}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener(
              "webglcontextlost",
              () => setContextLost(true),
              { once: true },
            );
          }}
        >
          <Contents workspace={workspace} />
        </Canvas>
      )}
    </ErrorBoundary>
  );
}
