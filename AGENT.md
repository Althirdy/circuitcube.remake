AGENT.md — CircuitCube

Project Mission

CircuitCube is a browser-based interactive 3D electronics simulator inspired by visual breadboard tools such as Tinkercad.

The application is already beyond the initial asset-viewer stage. The current repository contains a 3D workspace, two breadboard sizes, dynamic jumper wiring, an interactive DC supply, LEDs, an SPDT slide switch, series resistor/DC behavior, and 7408/7432/7404 digital IC implementation. IC builds and tests are awaiting user execution; do not describe that milestone as browser-verified yet.

Future work must extend the existing architecture instead of rebuilding it.

CircuitCube should remain:

browser-friendly

modular

visually understandable

electrically predictable

testable

incremental rather than over-engineered

Current Technology Stack

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

Do not add a new major dependency unless it solves a real current requirement that the existing stack cannot handle cleanly.

Architecture Contract

Keep these responsibilities separated:

Blender / GLB
    ↓
geometry
materials
object hierarchy
pivots
named interactive meshes
named terminal anchors

React / React Three Fiber
    ↓
rendering
selection
dragging
camera interaction
visual animation
pointer interaction
wire rendering

Workspace State

Presentation preferences are separate from circuit state: the theme provider owns system/light/dark resolution and a localStorage override; sidebar accordions own session expansion. Categories are Boards, Power, Basic components, and Logic ICs. Only Boards starts expanded. On the workplane and Jumper wires remain available as collapsed headers with counts. Theme tokens also control canvas background/grid and interaction highlights; do not recolor electrical component assets or persisted wire colors for themes. IC guides use a fixed notch-up SVG reference generated from package definitions and mount sockets, with explicit VCC pin 14/GND pin 7 labels. These UI additions have authored tests and await user-run validation.
    ↓
component instances
mount state
switch state
wires
selection
interaction mode

Circuit Engine
    ↓
breadboard connectivity
terminal networks
switch connections
power state
polarity
LED state
fault detection

Rules:

Never put electrical simulation logic inside Blender.

Never make the renderer the source of truth for electrical connectivity.

Blender owns geometry and stable object contracts.

TypeScript owns circuit behavior.

React owns interaction and visualization.

Keep electrical calculations pure and derived where practical.

Current Repository Structure

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
│   ├── breadboard-large.glb
│   ├── power.glb
│   ├── led.glb
│   ├── slide-switch.glb
│   └── additional source assets as developed
│
├── scripts/
│   ├── create_breadboard.py
│   └── setup-frontend.ps1
│
├── AGENT.md
└── README.md

Do not reorganize the project into a package monorepo unless the application becomes large enough to justify it.

Do not create empty Docker, infrastructure, or CI folders only for appearance.

Current Runtime Component Catalog

The current integrated runtime components are:

breadboard
breadboard-large
power
led
slide-switch
resistor
ic-7408
ic-7432
ic-7404

Source GLBs:

models/breadboard.glb
models/breadboard-large.glb
models/power.glb
models/led.glb
models/slide-switch.glb

frontend/scripts/sync-models.mjs copies source GLBs into frontend/public/models/.

Generated files in frontend/public/models/ are not the source of truth.

Asset Scale and Orientation Policy

Asset scale must always be explicit.

Existing 10x assets

These currently use a 10x Blender working scale and runtime scale 0.1:

breadboard
breadboard-large
power
led

Real-size assets

The slide switch is real physical size and currently uses:

scale: 1
rotation: [Math.PI / 2, 0, 0]

Its source orientation requires the +90° X runtime rotation.

New components such as resistors, switches, buttons, and future ICs should preferably use real physical dimensions unless there is a strong reason not to.

Do not assume all GLBs use the same source scale.

Do not silently change scale or coordinate assumptions of an integrated asset.

Breadboard Contract

CircuitCube currently supports two breadboards.

Half-Size Breadboard

Runtime ID:

breadboard

Structure:

30 numbered columns

rows a through j

300 terminal sockets

4 × 25-hole power rails

400 total sockets

Connectivity:

a1 b1 c1 d1 e1 -> one node
f1 g1 h1 i1 j1 -> another node

The same rule applies to each numbered column.

Printed red/blue rail colors are visual only and do not assign polarity.

Full-Size Breadboard

Runtime ID:

breadboard-large

This is a full 830 tie-point breadboard:

63 columns × 10 rows = 630
4 rails × 50 holes   = 200
--------------------------
TOTAL                 = 830

Do not call it an "800-pin breadboard" in code or documentation.

Each 50-hole power rail is split electrically:

holes 1–25  -> left segment
holes 26–50 -> right segment

A jumper is required to bridge the two halves.

Stable IDs include:

a1 ... j63
top-positive-1 ... top-positive-50
top-negative-1 ... top-negative-50
bottom-positive-1 ... bottom-positive-50
bottom-negative-1 ... bottom-negative-50

The breadboard engine is authoritative for runtime socket definitions.

The old scripts/create_breadboard.py is not authoritative for the current exported GLBs.

Do not regenerate the current runtime breadboards from it unless the asset contract is intentionally being replaced.

Power Supply Contract

The bench DC power supply is already interactive and participates in logical power simulation.

Stable names include:

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

Runtime anchors:

Positive_Wire_Anchor
Negative_Wire_Anchor

The frontend may derive those anchors from the terminal metal geometry when they are absent from the source GLB.

A stationary click toggles requested output.

Dragging the supply must not accidentally toggle the rocker.

Requested switch state and actual output state are separate:

requested output
      ↓
circuit evaluation
      ↓
actual output

A circuit fault may suppress output while the rocker remains visually ON.

LED Contract

Stable names:

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

anode   -> positive side
cathode -> negative side

Mounted LEDs occupy two breadboard sockets.

The runtime may shorten cloned LED pin transforms for mounting but must never mutate shared source GLB geometry.

Each LED instance must own its animated emissive materials so one LED can glow independently of another.

LED illumination comes from the circuit engine.

SPDT Slide Switch Contract

Runtime ID:

slide-switch

The slide switch is already integrated into:

the model catalog

workspace placement

breadboard mounting

interaction

circuit evaluation

visual animation

Playwright tests

Stable asset names:

SlideSwitch_Root
SlideSwitch_Body
SlideSwitch_Metal_Frame
SlideSwitch_Slot

SlideSwitch_Slider
SlideSwitch_Slider_Grip

SlideSwitch_Pin_1
SlideSwitch_Pin_2
SlideSwitch_Pin_3

SlideSwitch_Anchor_1
SlideSwitch_Anchor_2
SlideSwitch_Anchor_3

SlideSwitch_Slider_Left_Anchor
SlideSwitch_Slider_Right_Anchor

Pin roles:

Pin 1 = throw A
Pin 2 = common
Pin 3 = throw B

Electrical behavior:

LEFT
Pin 1 ↔ Pin 2
Pin 3 disconnected

RIGHT
Pin 1 disconnected
Pin 2 ↔ Pin 3

The switch does not generate positive or negative voltage itself.

For a HIGH/LOW input selector:

Pin 1 -> VCC / positive
Pin 2 -> output / IC input
Pin 3 -> GND / negative

Then:

LEFT  -> common receives HIGH
RIGHT -> common receives LOW

Runtime state:

switchPosition?: "left" | "right";

Mounting

A mounted slide switch uses three adjacent numbered terminal holes in one row.

Example:

e10
e11 <- common
e12

Reject:

rails

non-adjacent columns

mixed rows

occupied sockets

out-of-range sockets

Rotating a mounted switch reverses physical pin ordering without changing its stored electrical state.

Animation

React animates:

SlideSwitch_Slider
SlideSwitch_Slider_Grip

using the delta between:

SlideSwitch_Slider_Left_Anchor
SlideSwitch_Slider_Right_Anchor

Do not hard-code a different travel distance unless the source asset changes.

Resistor Contract — Runtime Integrated

The resistor is integrated into the catalog, mounting, selectable resistance, color bands and limited series DC evaluator. Exact values and mounting rules are documented in docs/asset-contract.md.

Recommended stable names:

Resistor_Root
Resistor_Body

Resistor_Band_1
Resistor_Band_2
Resistor_Band_3
Resistor_Band_4

Resistor_Lead_Left
Resistor_Lead_Right

Resistor_Left_Anchor
Resistor_Right_Anchor

The resistor is non-polarized.

One GLB should support many resistance values.

Do not create separate GLBs for every resistor value.

Component state should eventually contain values such as:

{
  resistanceOhms: 1000,
  tolerancePercent: 5
}

React may recolor the separate band meshes.

Resistance belongs in TypeScript domain state and the circuit engine, not Blender.

Push Button Status

A tactile push-button asset may exist as an experiment, but it is not currently a runtime priority.

Do not integrate it ahead of the resistor unless there is a concrete feature requiring momentary switching.

If integrated later, model electrical state as:

pressed: boolean

not positive/negative.

Keep physical actuator animation separate from electrical connectivity.

Dynamic Jumper Wire Contract

Jumper wires are runtime-generated geometry.

Do not create permanent GLBs for ordinary workspace jumper wires.

Current wire data includes the concepts:

{
  from,
  to,
  color,
  bends,
  height
}

Wire endpoints must stay attached when components move or rotate.

Visual wire crossings do not create electrical junctions.

Only explicit terminal connections create electrical connectivity.

Circuit Engine

Relevant current modules include:

frontend/src/engine/breadboard.ts
frontend/src/engine/connections.ts
frontend/src/engine/power.ts
frontend/src/engine/terminals.ts

Current Supported Behavior

The engine already supports:

breadboard conducting groups

jumper-wire connectivity

supply ON/OFF

positive/negative propagation

LED polarity

LED ON/OFF

slide-switch selected contacts

short-circuit detection

multiple connected enabled-source faults

independent circuits

fault recovery after invalid connections are removed

Supply states include:

off
on
short-circuit
multiple-supplies

LED states include:

on
unmounted
unconnected
supply-off
reversed
same-network
fault

Current Simulation Limits

CircuitCube calculates limited series DC current, resistor dissipation, LED forward-drop behavior and current-based brightness. Digital gates are evaluated separately through the shared graph. One series LED/resistor load per digital output supports sourcing or sinking. Unsupported topologies retain unavailable results; no general nodal solver, thermal model or internal IC current model is present. See docs/asset-contract.md for the precise supported boundaries.

Recommended Resistor Simulation Direction

A reasonable first progression is:

topology
   ↓
source voltage
   ↓
resistor value
   ↓
LED forward-voltage approximation
   ↓
series current
   ↓
LED state

For a simple DC series circuit:

I = (Vs - Vf) / R

when:

Vs > Vf

Start with intentionally limited DC series-circuit behavior.

Do not implement a general nodal-analysis engine until the product actually requires it.

Workspace State

The project currently uses React reducer-based workspace state.

Do not introduce Zustand merely because an older plan mentioned it.

Workspace state currently covers:

assets

placed instances

wires

selection

placement

mounting

switch state

requested power state

wire editing

interaction messages

Keep circuit calculations outside the store when they can remain pure derived functions.

Scene and Interaction Architecture

Important files include:

frontend/src/scene/CircuitScene.tsx
frontend/src/scene/AssetLoader.tsx
frontend/src/scene/CameraRig.tsx
frontend/src/scene/useSceneInteraction.ts

frontend/src/components/3d/ModelInstance.tsx
frontend/src/components/3d/Connections.tsx
frontend/src/components/3d/Wire.tsx

useSceneInteraction.ts is already a major interaction hotspot.

It currently handles responsibilities such as:

raycasting

component dragging

socket targeting

LED mounting

slide-switch mounting

power-switch interaction

wire drawing

bend editing

pointer capture

camera coordination

Do not keep adding every future component-specific behavior into one file indefinitely.

When complexity materially increases, consider focused modules such as:

scene/interactions/
├── hitTesting.ts
├── dragging.ts
├── mounting.ts
├── wiring.ts
└── switching.ts

Refactor only when the new work makes the split useful.

Model Loading Rules

Use the current Three.js / Drei GLB pipeline.

Do not manually recreate complex Blender assets from hundreds of JSX primitives without a strong technical reason.

Stable object names are part of the runtime contract.

Example:

scene.getObjectByName("SlideSwitch_Slider");

Changing a stable name may break rendering, interaction, or tests.

Performance Rules

Always consider:

GLB size

polygon count

draw calls

material count

object count

runtime geometry allocation

duplicated materials/textures

unnecessary animation frames

Prefer:

merged decorative meshes

shared immutable geometry

cloned materials only when per-instance animation requires them

logical metadata instead of visible helper geometry

demand-based rendering

low-to-moderate polygon assets

Avoid:

hundreds of expensive Blender Boolean operations

unnecessary subdivision

photorealistic geometry that hurts browser interaction

one permanent Three.js object for every purely logical point unless necessary

Testing Contract

Playwright coverage is an important part of CircuitCube.

Current tests cover areas including:

component placement

camera behavior

WebGL fallback

narrow/responsive layouts

breadboard socket alignment

both breadboard sizes

jumper-wire creation

bend editing

LED mounting

socket occupancy

power propagation

circuit faults

slide-switch mounting

slide-switch animation

slide-switch contact selection

browser-level powered circuits

When adding a new electrical component, add:

pure domain/electrical tests

mounting/connection tests

browser interaction tests where practical

Do not weaken existing tests just to make new code pass.

Current Project Status

Implemented

React/TypeScript 3D workspace

Half-size 400-point breadboard

Full-size 830-point breadboard

Bench DC power supply

5 mm LED

Component library

Placement

Dragging

Rotation

Deletion

Camera controls

Grid snapping

Breadboard socket targeting

Dynamic jumper wires

Wire colors

Wire height

Wire bend editing

LED mounting

LED polarity

Power switch interaction

LED glow

Logical power propagation

Short-circuit detection

Multiple-source fault detection

SPDT slide switch

Slide-switch mounting

Slide-switch visual animation

Slide-switch electrical switching

Playwright integration coverage

Next Engineering Work

User-run validation of the digital IC implementation, including anchor alignment, gate truth tables, output loads, mounting interactions and the pin inspector.

Later

Workspace persistence

Capacitors

Potentiometers

Push buttons

Additional IC families, sequential logic, timing and richer digital visualization

Arduino / ESP32

richer analog simulation

Do not skip directly to microcontrollers before the core component/circuit model is strong.

Recommended Immediate Roadmap

Milestone 1 — Resistor Runtime Integration

Integrate the resistor visually first.

Required areas:

ModelId
modelCatalog
sync-models
asset preparation
placement
breadboard mounting
selection UI
tests

Do not change analog electrical behavior in the same step unless necessary.

Milestone 2 — Resistor Electrical Data

Add:

resistanceOhms
tolerancePercent

and dynamic band colors.

Milestone 3 — Simple DC Current Model

Support an intentionally limited series circuit such as:

Power +
   ↓
Resistor
   ↓
LED
   ↓
Power -

Milestone 4 — Digital IC Foundation (implemented; verification pending)

7408, 7432 and 7404 use shared DIP mounting and pure digital primitives in engine/digital. IC instances have a separate typed variant; legacy DC fields retain compatibility during the incremental migration. The existing SPDT switch selects HIGH/LOW inputs. Combinational chains, unknown inputs, cycles and contention are explicit. Source/sink output loads are evaluated outside the bench DC solver. Pin definitions and electrical behavior never live in GLBs or React components.

IC source assets have scale 0.01, no axis rotation, 2.54 mm pin pitch and 7.62 mm row spacing. The breadboards have a 9.2 mm e/f gap, so cloned pins and anchors spread 0.79 mm per row when mounted. Preserve bodies, source geometry and stable ICxxxx node names. See docs/asset-contract.md for this intentional asset adaptation.

Coding Standards

TypeScript

use TypeScript

avoid any

prefer explicit domain types

keep circuit logic pure where practical

use descriptive names

avoid premature abstractions

React

use functional components

keep App.tsx thin

keep Three.js concerns inside scene/3D layers

do not mutate shared GLB geometry unexpectedly

keep UI state separate from derived electrical results

Blender Python

Use reproducible generators where practical.

Naming examples:

create_breadboard_*.py
create_resistor_*.py
create_slide_switch_*.py
create_push_button_*.py

Document:

physical dimensions

working scale

coordinate system

stable object names

terminal anchors

interactive meshes

Development Commands

From:

cd frontend

Development:

npm.cmd run dev

Verification:

npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e

If the repository's edit-only development skill is active, the user may need to run verification commands instead of the coding agent.

Infrastructure Guardrails

Do not over-engineer deployment while core simulator work is still progressing.

Add Docker, CI/CD, observability, or infrastructure only when there is a real deployment requirement.

Do not introduce technologies such as:

Kubernetes

Kafka

Redis

microservices

without a concrete need.

A reasonable future deployment path is:

GitHub
   ↓
CI
   ↓
lint / build / tests
   ↓
frontend artifact or container
   ↓
hosting

Documentation Rules

docs/asset-contract.md is an important implementation contract.

Update it when:

source object names change

model scale changes

orientation changes

terminal anchors change

breadboard socket coordinates change

component mounting rules change

electrical behavior changes

AGENT.md describes project-level engineering guidance.

docs/asset-contract.md should remain more exact about asset/runtime implementation details.

Agent Behavior

When working in this repository:

Read AGENT.md.

Inspect the actual current implementation before proposing changes.

Read docs/asset-contract.md before modifying an asset/runtime contract.

Preserve stable GLB object names used by React.

Do not silently change scale or coordinate assumptions.

Never put electrical simulation logic inside Blender.

Keep circuit evaluation separate from rendering.

Prefer incremental changes.

Preserve unrelated user work.

Do not add dependencies for appearance.

Keep CircuitCube browser-friendly.

Add or update tests for important behaviors.

Update documentation when implementation contracts change.

Do not describe already implemented features as future work.

Do not assume an old roadmap is more accurate than the repository.

When uncertain, inspect the existing code first.

CircuitCube should become more capable by strengthening its electronics model and interaction quality, not by accumulating unnecessary technologies.
