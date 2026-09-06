# AGENT.md — CircuitCube

## Project Overview

CircuitCube is a browser-based interactive electronics simulator.

The first goal is intentionally small:

- Render a 3D breadboard.
- Render a bench DC power supply.
- Render a reusable LED.
- Allow the user to place and inspect components.
- Later, allow users to connect wires between component terminals.
- Later, simulate a simple powered LED circuit.

CircuitCube should feel simple and approachable, inspired by tools such as Tinkercad, but the project must remain lightweight and modular.

---

## Current Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- `@react-three/drei`

Do not introduce new dependencies unless they solve a real current requirement.

### 3D Asset Pipeline

- Blender
- Blender Python (`bpy`)
- GLB / glTF for runtime assets

Blender is responsible for:

- geometry
- materials
- object hierarchy
- pivots
- named mesh parts
- named wire/connectivity anchors

React / Three.js is responsible for:

- rendering
- selection
- dragging
- camera interaction
- switch interaction
- knob interaction
- LED color
- LED ON/OFF glow
- dynamic wires
- visual circuit state

TypeScript simulation logic will eventually be responsible for:

- connectivity
- polarity
- power state
- voltage
- component behavior

Do not put circuit simulation logic inside Blender assets.

---

## Repository Structure

Use this structure unless there is a strong reason to change it:

```text
circuitcube/
│
├── frontend/
│   ├── public/
│   │   └── models/
│   │
│   ├── src/
│   │   ├── components/
│   │   │   └── 3d/
│   │   ├── scene/
│   │   ├── engine/
│   │   ├── store/
│   │   ├── types/
│   │   └── lib/
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── models/
│   ├── blender/
│   │   ├── breadboard/
│   │   ├── power-supply/
│   │   └── led/
│   │
│   └── exports/
│       ├── breadboard.glb
│       ├── power-supply.glb
│       └── led.glb
│
├── scripts/
│   └── setup-frontend.ps1
│
├── docs/
│
├── docker/
│
├── infra/
│
├── .github/
│   └── workflows/
│
├── AGENT.md
├── .gitignore
└── README.md
```

Notes:

- `models/blender/` contains `.blend` files and Blender Python generators.
- `models/exports/` contains exported source GLB files.
- `frontend/public/models/` contains GLBs used by the running web app.
- `docker/`, `infra/`, and `.github/` should only gain real configuration when needed.
- Do not add infrastructure complexity before there is an application worth deploying.

---

## Current Assets

The project currently has or is developing these components:

1. Breadboard
2. Bench DC power supply
3. 5mm through-hole LED

Planned next components:

4. Resistor
5. Jumper wire

Do not jump ahead to Arduino, ESP32, sensors, MQTT, multiplayer, or advanced simulation until the MVP works.

---

## Blender Modeling Rules

### General

All current Blender-generated components use a **10x working scale** for easier editing.

The runtime app may scale GLB assets as needed.

Prefer:

- low-to-moderate polygon counts
- clean object naming
- reusable materials
- simple geometry
- GLB-friendly meshes
- sensible pivots
- named anchors

Avoid:

- unnecessary subdivision
- hundreds of expensive Boolean modifiers
- photorealistic geometry that hurts browser performance
- giant textures when geometry/materials are enough

### Breadboard

The breadboard is based on a 400 tie-point half-size breadboard style:

- 30 numbered terminal columns
- 10 terminal rows (`a` through `j`)
- 300 terminal sockets
- 100 power rail sockets
- center trench
- red/blue rail markings
- numbered labels

Electrical grouping should eventually behave like:

```text
a1 b1 c1 d1 e1 -> one node
f1 g1 h1 i1 j1 -> another node
```

Do not make the renderer responsible for knowing breadboard connectivity.

### Power Supply

Important named parts should remain stable:

```text
PowerSupply_Root
Power_Switch
Voltage_Knob
Current_Knob
Positive_Terminal_Metal
Negative_Terminal_Metal
Positive_Wire_Anchor
Negative_Wire_Anchor
```

If anchors do not yet exist in the asset, add them before wiring logic is implemented.

React should eventually be able to:

- toggle `Power_Switch`
- rotate `Voltage_Knob`
- rotate `Current_Knob`
- update displayed voltage
- connect wires to positive/negative anchors

### LED

Important named parts:

```text
LED_Root
LED_Lens
LED_Dome
LED_Anode_Pin
LED_Cathode_Pin
Anode_Wire_Anchor
Cathode_Wire_Anchor
LED_Glow_Anchor
```

Rules:

- Anode is the longer leg.
- Cathode is the shorter leg.
- Cathode should have a visual flat-side indicator.
- Both legs must visibly connect to the LED body.
- One LED GLB should be reusable for red, green, blue, yellow, etc.

Do not create separate GLB files for each LED color unless there is a future technical reason.

React should control:

- LED color
- emissive color
- emissive intensity
- ON/OFF state

---

## Frontend Architecture

Keep rendering and electronics logic separate.

Preferred conceptual architecture:

```text
React UI
   │
   ▼
Application State
   │
   ├──────────────► 3D Renderer
   │                 React Three Fiber
   │
   └──────────────► Circuit Engine
                     Pure TypeScript
```

### 3D Components

Recommended initial components:

```text
src/components/3d/
├── Breadboard.tsx
├── PowerSupply.tsx
├── Led.tsx
└── Wire.tsx
```

### Scene

Recommended:

```text
src/scene/
└── CircuitScene.tsx
```

The scene should handle things such as:

- `<Canvas>`
- camera
- lights
- grid
- orbit controls
- top-level component placement

Do not put all scene logic in `App.tsx`.

---

## GLB Loading

Use Drei's `useGLTF`.

Example:

```tsx
import { useGLTF } from "@react-three/drei";

export function Breadboard() {
  const { scene } = useGLTF("/models/breadboard.glb");

  return (
    <primitive
      object={scene}
      scale={0.1}
    />
  );
}
```

Do not recreate complex Blender assets manually using hundreds of JSX primitives unless there is a strong technical reason.

---

## Interactive Parts

Named GLB objects may be retrieved with:

```ts
scene.getObjectByName("Power_Switch");
```

Use stable Blender object names as part of the contract between assets and React.

Interactions expected later:

```text
Power switch click
    ↓
power state changes
    ↓
switch visually moves
    ↓
circuit engine reevaluates
```

```text
LED state changes
    ↓
material emissive intensity changes
```

```text
terminal click
    ↓
wire start point selected
    ↓
second terminal selected
    ↓
dynamic wire created
```

---

## Circuit Engine Rules

The first circuit engine should be simple.

Do not start by building a full SPICE simulator.

### MVP

Start with:

- connectivity
- source ON/OFF
- positive/negative polarity
- simple LED behavior

Conceptually:

```text
Power Supply (+)
      │
      ▼
Breadboard
      │
      ▼
LED Anode
LED Cathode
      │
      ▼
Power Supply (-)
```

If there is a valid closed path and polarity is correct:

```text
LED = ON
```

Otherwise:

```text
LED = OFF
```

### Later

Only after MVP works, consider:

- voltage
- forward voltage
- resistors
- Ohm's law
- brightness
- current
- short-circuit warnings
- switches/buttons
- Arduino
- ESP32

---

## State Management

Do not add Zustand until state complexity justifies it.

React state is enough for the earliest scene.

When the project grows, a store may hold:

```ts
{
  components: [],
  wires: [],
  selectedComponentId: null,
  simulationRunning: false,
  powerSupplies: {}
}
```

If Zustand is introduced, keep simulation calculations out of the store where possible.

---

## Dynamic Wires

Wires should be created in Three.js / React Three Fiber, not permanently modeled in Blender.

Future model:

```ts
type WireConnection = {
  from: {
    componentId: string;
    terminalId: string;
  };
  to: {
    componentId: string;
    terminalId: string;
  };
};
```

Curved wires may later use a Three.js curve such as:

```ts
THREE.CatmullRomCurve3
```

Wire endpoints must come from component anchors or calculated terminal coordinates.

---

## Coding Standards

### TypeScript

- Use TypeScript instead of plain JavaScript.
- Prefer explicit domain types.
- Avoid `any`.
- Keep components reasonably small.
- Extract reusable logic.
- Prefer descriptive names over short names.

Example:

```ts
type LedColor =
  | "red"
  | "green"
  | "blue"
  | "yellow";
```

### React

- Prefer functional components.
- Keep `App.tsx` thin.
- Keep 3D concerns inside 3D/scene components.
- Avoid unnecessary global state.
- Avoid premature abstractions.

### File Naming

React components:

```text
PascalCase.tsx
```

Utilities:

```text
camelCase.ts
```

Blender Python:

```text
create_breadboard.py
create_power_supply.py
create_led.py
```

GLB runtime files:

```text
breadboard.glb
power-supply.glb
led.glb
```

---

## Performance Rules

CircuitCube is a browser application.

Always consider:

- draw calls
- polygon counts
- model size
- material count
- texture size
- object count

Do not optimize blindly, but do not introduce obviously expensive modeling patterns.

Prefer a few merged visual meshes over hundreds of individual decorative objects when practical.

Logical interaction points do not always need visible geometry.

---

## Development Commands

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Current minimum 3D dependencies:

```powershell
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

---

## Docker / Infrastructure

Do not over-engineer deployment early.

Docker should be added after the frontend can successfully render and interact with models.

Later:

```text
docker/
├── frontend.Dockerfile
└── nginx.conf
```

Infrastructure may eventually include:

```text
infra/
├── terraform/
├── caddy/
└── monitoring/
```

Possible future deployment flow:

```text
GitHub
  ↓
GitHub Actions
  ↓
Build/Test
  ↓
Docker image
  ↓
Container registry
  ↓
VPS / cloud
```

Do not add Kubernetes, Redis, Kafka, microservices, or similar infrastructure without a concrete requirement.

---

## MVP Roadmap

### Phase 1 — Assets

- [x] Breadboard
- [x] Bench power supply
- [x] LED
- [ ] Resistor
- [ ] Jumper wire strategy

### Phase 2 — 3D Browser Scene

- [ ] Render breadboard GLB
- [ ] Render power supply GLB
- [ ] Render LED GLB
- [ ] Orbit camera
- [ ] Grid
- [ ] Lighting
- [ ] Selection

### Phase 3 — Interaction

- [ ] Move components
- [ ] Click breadboard holes
- [ ] Toggle power supply
- [ ] Rotate voltage knob
- [ ] Select LED pins
- [ ] Create wire connections

### Phase 4 — Basic Simulation

- [ ] Represent components as circuit nodes
- [ ] Represent wires as edges
- [ ] Breadboard connectivity mapping
- [ ] Power ON/OFF
- [ ] LED polarity
- [ ] LED ON/OFF

### Phase 5 — Product Polish

- [ ] Component sidebar
- [ ] Run / Stop
- [ ] Reset
- [ ] Delete component
- [ ] Properties panel
- [ ] Save locally

---

## Scope Guardrails

When implementing a feature, prefer the smallest useful version.

Do not turn a simple task into a platform rewrite.

Before adding a dependency, ask:

1. Is it required now?
2. Can the existing stack do it cleanly?
3. Does it make the code easier to maintain?

Before adding infrastructure, ask:

1. Is there something deployable yet?
2. Is this solving a current problem?
3. Does it meaningfully improve CircuitCube?

CircuitCube's strength should come from the quality of the simulator, interaction model, and engineering — not from having the largest technology stack.

---

## Agent Behavior

When working in this repository:

1. Read this file before making architectural changes.
2. Inspect existing files before replacing implementations.
3. Preserve stable GLB object names used by React.
4. Do not change Blender coordinate assumptions silently.
5. Do not introduce major dependencies without explaining why.
6. Prefer incremental changes that can be tested immediately.
7. Keep the MVP scope in mind.
8. When changing asset contracts, update both Blender scripts and frontend usage.
9. Never put electrical simulation logic inside Blender.
10. Keep CircuitCube browser-friendly.

When uncertain, prefer the simpler implementation.
