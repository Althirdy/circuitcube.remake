AGENT.md — CircuitCube

Project Mission

CircuitCube is a browser-based interactive 3D electronics simulator.

The project should feel approachable like a visual breadboard tool while remaining technically clean, modular, and browser-friendly.

CircuitCube is no longer only a 3D asset viewer. The repository already contains:

a React/TypeScript 3D workspace;

component placement, movement, rotation, selection, and deletion;

camera controls and grid snapping;

breadboard socket targeting;

dynamic jumper-wire creation and editing;

LED mounting and polarity handling;

an interactive bench DC power supply;

logical power propagation;

short-circuit and multiple-source fault detection;

Playwright browser tests.

The next work should extend this foundation instead of rebuilding it.

Technology Stack

Frontend

React

TypeScript

Vite

Three.js

React Three Fiber

@react-three/drei

Testing

Playwright

3D Asset Pipeline

Blender

Blender Python (bpy)

GLB / glTF

Do not introduce a new major dependency unless it solves a real requirement that the current stack cannot handle cleanly.

Architecture Contract

Keep these responsibilities separate.

Blender / GLB
    ↓
geometry
materials
mesh hierarchy
pivots
named interactive parts
named terminal anchors

React / React Three Fiber
    ↓
rendering
selection
dragging
camera interaction
component animation
wire visualization
pointer interaction

Workspace State
    ↓
placed component instances
wire instances
selection
interaction mode
component UI state

Circuit Engine
    ↓
electrical connectivity
breadboard groups
power state
polarity
fault detection
component electrical behavior

Never put electrical simulation logic inside Blender.

Never make the renderer the source of truth for electrical connectivity.

Actual Repository Structure

The current repository is organized approximately as:

circuitcube.remake/
│
├── .agents/
│   └── skills/
│
├── docs/
│   └── asset-contract.md
│
├── frontend/
│   ├── public/
│   │   └── models/
│   ├── scripts/
│   │   └── sync-models.mjs
│   ├── src/
│   │   ├── components/
│   │   │   └── 3d/
│   │   ├── engine/
│   │   ├── lib/
│   │   ├── scene/
│   │   ├── store/
│   │   └── types/
│   ├── tests/
│   ├── package.json
│   └── playwright.config.ts
│
├── models/
│   ├── breadboard.glb
│   ├── power.glb
│   └── led.glb
│
├── scripts/
│   ├── create_breadboard.py
│   └── setup-frontend.ps1
│
├── AGENT.md
└── ...

Do not rewrite the repository into a monorepo/packages layout unless the project grows enough to justify it.

Do not create empty infrastructure folders only for appearance.

Current Runtime Assets

The currently integrated runtime catalog contains:

breadboard
power
led

The source GLBs are:

models/breadboard.glb
models/power.glb
models/led.glb

frontend/scripts/sync-models.mjs copies these into frontend/public/models/ before development and production builds.

Generated copies under frontend/public/models/ are not the source of truth.

Asset Scale Policy

Asset scale must be explicit.

Existing integrated assets

The current integrated:

breadboard

power supply

LED

were modeled at a 10x Blender working scale and use:

scale: 0.1

at runtime.

New real-size assets

Newer components such as the resistor and tactile push button are being modeled at real physical size.

These should normally use:

scale: 1.0

at runtime.

Do not assume every GLB uses the same source scale.

The modelCatalog runtime scale is part of the asset contract.

Do not silently rescale an existing integrated asset.

Breadboard Contract

Current integrated breadboard

The current runtime breadboard is the 400-contact half-size asset:

30 numbered columns;

rows a through j;

300 terminal sockets;

100 power-rail sockets.

The runtime socket coordinates are currently defined in:

frontend/src/engine/breadboard.ts

Electrical grouping is:

a1 b1 c1 d1 e1  -> one conducting node
f1 g1 h1 i1 j1  -> another conducting node

Power rails are modeled as logical groups independently of their printed colors.

Full-size 830-point breadboard

A new full-size breadboard asset is being developed with:

63 numbered columns;

630 terminal sockets;

4 power rails × 50 sockets;

830 total tie points;

center DIP trench;

realistic red/blue rail markings.

Desired full-board rail behavior:

rail holes 1-25  -> left rail segment
rail holes 26-50 -> right rail segment

When the 830-point model replaces or joins the runtime catalog, update all of these together:

source GLB;

modelCatalog.ts;

socket definitions;

breadboard group logic;

placement/mounting assumptions;

connection tests;

power tests;

docs/asset-contract.md.

Do not regenerate the current 400-contact runtime GLB using the old scripts/create_breadboard.py; that script describes a different 830-hole prototype and is not the source of the currently integrated board.

Power Supply Contract

Stable source mesh names currently used by the frontend include:

Power_Switch
Power_Switch_Housing
Voltage_Knob
Current_Knob
Positive_Terminal_Metal
Negative_Terminal_Metal
Positive_Terminal_Base
Negative_Terminal_Base
Display_Glass
Display_Voltage
Display_Unit

Runtime terminal anchors are derived from the terminal metal meshes when explicit source anchors are unavailable:

Positive_Wire_Anchor
Negative_Wire_Anchor

The power switch is interactive.

A stationary click can toggle requested output.

Dragging the component must not accidentally toggle the switch.

The rocker visual state and actual electrical output state are different concepts:

requested switch state
        ↓
circuit evaluation
        ↓
actual output state

A requested ON state can still have output suppressed by a circuit fault.

LED Contract

Stable names include:

LED_Root
LED_Lens
LED_Dome
LED_BaseFlange
LED_Anode_Pin
LED_Cathode_Pin
Anode_Wire_Anchor
Cathode_Wire_Anchor
LED_Glow_Anchor

The LED is polarized:

anode = positive side;

cathode = negative side.

Mounted LEDs use two breadboard sockets.

The renderer may shorten cloned lead meshes visually while mounting, but must not mutate the shared source GLB geometry.

Each LED instance must own its animated emissive materials so one LED can glow without affecting another.

LED illumination is driven by the circuit engine, not by pointer interaction alone.

Resistor Asset Contract

The resistor asset is being developed as a real-size axial through-hole resistor.

Recommended stable names:

Resistor_Root
Resistor_Body

Resistor_Band_1
Resistor_Band_2
Resistor_Band_3
Resistor_Band_4

Resistor_Lead_Left
Resistor_Lead_Right
Resistor_Lead_Left_Down
Resistor_Lead_Right_Down

Resistor_Left_Anchor
Resistor_Right_Anchor

The resistor is non-polarized.

One source GLB should support many resistor values.

Do not create a separate GLB for every resistance.

React may recolor the band meshes based on the selected resistance value.

Example conceptual data:

{
  resistanceOhms: 1000,
  tolerancePercent: 5
}

When resistor simulation is introduced, resistance belongs in the circuit engine/domain state, not in Blender.

Do not introduce voltage/current calculations until the electrical model for resistors is intentionally designed.

Tactile Push Button Contract

The tactile push button is being developed as a real-size 6×6 mm momentary switch.

Stable names should include:

PushButton_Root
PushButton_Base
PushButton_Metal_Frame
PushButton_Actuator

PushButton_Pin_1
PushButton_Pin_2
PushButton_Pin_3
PushButton_Pin_4

PushButton_Anchor_1
PushButton_Anchor_2
PushButton_Anchor_3
PushButton_Anchor_4

Mechanical behavior

PushButton_Actuator is the movable visual object.

React should animate it along local Y:

released -> rest Y
pressed  -> lower Y

The Blender asset may store:

actuator_rest_y
actuator_pressed_y
press_travel_m

Electrical behavior

Do not model the button as "positive" or "negative".

Model it as a switch state:

pressed: false
pressed: true

Typical 4-pin tactile-switch grouping:

Pin 1 + Pin 2 = Side A
Pin 3 + Pin 4 = Side B

Released:

Side A disconnected from Side B

Pressed:

Side A connected to Side B

This same mechanical/electrical separation should be reused for future switches and interactive IC-related controls.

Dynamic Wire Contract

Jumper wires are runtime geometry.

Do not create permanent jumper-wire GLBs for normal workspace wiring.

Current wire data includes:

source terminal;

destination terminal;

color;

editable bend points;

route height.

The renderer currently creates curved tube geometry from the serialized route.

Wire endpoints must stay attached when components move or rotate.

Crossing visual wire paths do not imply electrical connection.

Only terminal-to-terminal connections create conducting edges.

Circuit Engine

The electrical engine is pure TypeScript and currently handles simplified logical power.

Relevant modules include:

frontend/src/engine/breadboard.ts
frontend/src/engine/connections.ts
frontend/src/engine/power.ts
frontend/src/engine/terminals.ts

Current behavior

The engine already supports:

breadboard conducting groups;

completed-wire connectivity;

enabled/disabled supplies;

LED polarity;

open circuits;

short circuits;

same-network LED legs;

multiple connected enabled supplies;

fault suppression;

independent circuits.

Current supply states include:

off
on
short-circuit
multiple-supplies

Current LED states include:

on
unmounted
unconnected
supply-off
reversed
same-network
fault

Current simulation scope

The existing engine is intentionally logical rather than analog.

It does not yet calculate:

resistance;

voltage drop;

current;

power dissipation;

LED forward voltage;

brightness;

thermal effects.

Do not pretend these values are simulated before they actually are.

Do not jump directly to a SPICE-style simulator.

Grow the circuit model incrementally.

Workspace State

The project currently uses React state with a reducer-based workspace store.

Important state includes:

loaded asset states;

component instances;

wires;

selection;

interaction mode;

requested power-output state;

wire draft state;

wire display properties.

Keep electrical calculations out of the React store when they can remain pure derived functions.

Do not add Zustand merely because an older roadmap mentioned it.

Introduce a different state library only when there is a concrete reason.

Scene / Interaction Architecture

The current scene layer includes:

frontend/src/scene/AssetLoader.tsx
frontend/src/scene/CameraRig.tsx
frontend/src/scene/CircuitScene.tsx
frontend/src/scene/usePowerAnimation.ts
frontend/src/scene/useSceneInteraction.ts

useSceneInteraction.ts is already a large interaction hotspot.

It currently coordinates things such as:

raycasting;

socket targeting;

power-terminal targeting;

power-switch clicks;

component dragging;

LED mounting;

placement previews;

wire drawing;

bend editing;

pointer capture;

camera-control coordination.

Do not keep adding every new component-specific behavior into this one file indefinitely.

When complexity materially increases, prefer extracting focused helpers or hooks rather than rewriting the whole interaction system.

Potential future separation:

scene/interactions/
├── hitTesting.ts
├── componentDragging.ts
├── wiring.ts
├── mounting.ts
└── switchInteraction.ts

Refactor only when the new feature makes the split useful.

Rendering and Performance Rules

CircuitCube runs in the browser.

Always consider:

GLB size;

polygon count;

draw calls;

material count;

object count;

runtime-generated geometry;

texture memory;

repeated allocations.

Prefer:

shared immutable geometry;

cloned instance-specific materials only when animation requires them;

merged decorative meshes;

lightweight Blender assets;

logical socket metadata instead of hundreds of React objects;

demand-based rendering where practical.

Avoid:

hundreds of Boolean operations for breadboard holes;

unnecessary high subdivision;

one permanent Three.js object per purely logical connection point when it is not needed;

photorealistic assets that materially hurt interaction performance.

Model Naming Rules

Named GLB parts are part of the frontend contract.

Do not casually rename an object that React accesses using:

scene.getObjectByName("...")

When an asset contract changes:

update the Blender generator/source;

update frontend lookup code;

update tests;

update docs/asset-contract.md.

Use descriptive stable names.

Coding Standards

TypeScript

use TypeScript;

avoid any unless unavoidable;

prefer explicit domain types;

keep pure electrical logic separate from view code;

use descriptive names;

avoid premature abstractions.

React

use functional components;

keep App.tsx thin;

keep Three.js concerns inside scene/3D layers;

do not mutate shared loaded GLB resources unexpectedly;

do not make UI state the only source of circuit truth.

Blender Python

Use reproducible generators where practical.

Examples:

create_breadboard_*.py
create_resistor_*.py
create_push_button_*.py

Prefer real dimensions for new assets unless there is a clear reason to use a working scale.

If a working scale is used, document it in the asset and runtime catalog.

Current Development Milestones

Do not treat these as rigid project phases. They are the current direction and may overlap.

Already Implemented

3D workspace;

current 400-point breadboard runtime model;

power supply runtime model;

LED runtime model;

component library;

placement and dragging;

rotation and deletion;

camera presets;

grid snapping;

socket targeting;

jumper-wire drawing;

wire bend editing;

LED breadboard mounting;

power-supply rocker interaction;

logical power propagation;

LED glow;

short-circuit detection;

multiple-source fault detection;

Playwright coverage.

Asset Work In Progress

full-size 830-point breadboard;

real-size axial resistor;

real-size 6×6 tactile push button.

Recommended Next Engineering Work

finish and validate the new Blender assets;

integrate the resistor into the model catalog and mounting system;

add resistor electrical-domain data;

integrate the tactile button;

add pressed/released switch connectivity;

decide whether the 830-point board replaces the 400-point board or becomes a second breadboard option;

migrate the breadboard engine only after the 830 asset geometry is final;

add persistence later when workspace interactions are stable.

Testing Contract

Existing Playwright coverage is valuable and should remain part of CircuitCube development.

Tests already cover areas including:

actual GLB socket alignment;

component placement;

movement and rotation;

camera controls;

asset failures;

wire creation/editing;

LED mounting;

socket occupancy;

power states;

short circuits;

multiple supplies;

rocker interaction;

independent LED materials;

narrow layouts;

WebGL fallback.

When adding a new electrical component, add tests for both:

pure circuit behavior;

browser interaction behavior when practical.

Do not weaken existing tests just to make a new implementation pass.

Development Commands

From:

cd frontend

Development:

npm.cmd run dev

Static/build verification:

npm.cmd run lint
npm.cmd run build

Browser tests:

npm.cmd run test:e2e

The repository's edit-only development skill may require the user to run verification commands instead of the agent.

Deployment / Infrastructure

Application quality comes before deployment complexity.

Docker, CI/CD, observability, and infrastructure can be added when they solve a real deployment need.

Do not introduce:

Kubernetes;

Redis;

Kafka;

microservices;

distributed infrastructure;

without a concrete requirement.

A reasonable future deployment path is:

GitHub
  ↓
CI
  ↓
lint / build / tests
  ↓
static frontend build or container
  ↓
hosting

Scope Guardrails

Prefer the smallest implementation that advances the simulator.

Before adding a dependency, ask:

Is it needed now?

Can the current stack handle the problem cleanly?

Does it reduce complexity rather than move it elsewhere?

Before adding a new electrical feature, ask:

What is its terminal model?

Is it polarized?

Which terminals are internally connected?

Does its connectivity change with interaction?

What belongs in Blender versus React versus the circuit engine?

Before modifying an asset, ask:

Is its runtime scale documented?

Are object names already used by React?

Are anchors required?

Will the change invalidate measured terminal coordinates?

Do tests or the asset contract need to change?

Agent Behavior

When working in this repository:

Read this file before architectural or asset-contract changes.

Inspect the existing implementation before proposing a replacement.

Treat docs/asset-contract.md as an important runtime contract.

Preserve stable GLB object names used by React.

Never silently change an asset's scale or coordinate assumptions.

Never put electrical simulation logic inside Blender.

Keep circuit evaluation separate from rendering.

Prefer incremental changes that can be tested immediately.

Preserve unrelated user work.

Do not add infrastructure or dependencies for appearance.

Keep CircuitCube browser-friendly.

Update documentation when the implementation meaningfully changes.

When uncertain, prefer the simpler implementation that fits the existing architecture.

CircuitCube should grow from a strong interactive electronics core, not from accumulating technologies.