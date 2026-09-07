---
name: code-governance
description: Preserve CircuitCube code readability, type safety, architectural boundaries, naming consistency, testability, and long-term maintainability while implementing or refactoring features. Use automatically for substantive code changes in this repository, especially when touching component models, circuit simulation, workspace state, scene interactions, or shared architecture.
---

# CircuitCube Code Governance

Keep CircuitCube easy to understand and extend as the simulator grows.

This skill complements `edit-only-development`. The edit-only skill controls which commands may be executed. This skill controls the quality and structure of the code being changed.

## Core Principles

- Prefer clear responsibility boundaries over large multipurpose files.
- Prefer explicit domain types over loosely related optional properties.
- Prefer readable control flow over compressed expressions.
- Keep circuit-domain logic independent from rendering and Blender assets.
- Extend existing architecture incrementally instead of rewriting it.
- Preserve stable runtime and GLB contracts unless a change is intentional and documented.
- Do not introduce abstractions, libraries, folders, or patterns only for appearance.

## Repository Boundaries

Use the existing responsibilities as the default:

```text
frontend/src/engine/
    Electrical topology, electrical behavior, simulation algorithms,
    mounting validation, terminal-domain logic.

frontend/src/scene/
    React Three Fiber / Three.js scene behavior, hit testing,
    dragging, pointer interaction, camera coordination.

frontend/src/store/
    Workspace/application state and state transitions.

frontend/src/lib/
    Reusable helpers, geometry utilities, asset preparation,
    visual helpers, formatting.

frontend/src/components/
    React UI and 3D presentation components.

models/ and Blender assets
    Geometry, materials, object hierarchy, pivots, named meshes,
    terminal anchors and asset metadata.

docs/
    Runtime contracts and architecture documentation.
```

Do not put electrical simulation logic inside Blender, GLB metadata, React render components, or Three.js visual helpers.

Do not make rendered scene state the source of truth for electrical connectivity.

## Component Domain Modeling

Before adding a component-specific field to `ComponentInstance`, determine whether the type model is becoming too permissive.

Avoid indefinitely growing a structure like:

```ts
type ComponentInstance = {
  modelId: ModelId;
  voltage?: number;
  resistanceOhms?: number;
  switchPosition?: string;
  icType?: string;
  buzzerState?: boolean;
};
```

When component-specific state becomes substantial, prefer discriminated unions:

```ts
type BaseComponent = {
  id: string;
  position: GroundPosition;
  rotation: number;
};

type PowerInstance = BaseComponent & {
  modelId: "power";
  outputEnabled: boolean;
  voltage: number;
};

type ResistorInstance = BaseComponent & {
  modelId: "resistor";
  resistanceOhms: number;
  tolerancePercent: number;
  powerRatingWatts: number;
  resistorMount?: ResistorMount;
};

type LedInstance = BaseComponent & {
  modelId: "led";
  mount?: LedMount;
};

type LogicIcInstance = BaseComponent & {
  modelId: "ic-7408" | "ic-7432" | "ic-7404";
  icMount?: IcMount;
};

type ComponentInstance =
  | PowerInstance
  | ResistorInstance
  | LedInstance
  | LogicIcInstance;
```

Do not perform a broad type rewrite only because discriminated unions are preferable in theory. Make the transition when a feature materially benefits from the stronger boundary.

## Electrical Architecture

`circuitGraph.ts` is the shared topology foundation.

Keep topology discovery separate from electrical evaluation.

Target this conceptual boundary:

```text
                   Circuit Graph
                        |
             +----------+----------+
             |                     |
         DC evaluation         Digital evaluation
             |                     |
       power supply               7408 AND
       resistor                   7432 OR
       LED                        7404 NOT
       buzzer
```

Do not place digital IC truth-table evaluation directly inside the DC series solver.

Do not make resistors ideal-union their terminals.

Do not make LEDs ideal-union their terminals.

Do not invent numerical electrical values when the current model cannot determine them.

Represent unavailable results explicitly rather than fabricating approximations.

## DC Engine Boundaries

The current DC solver is intentionally limited.

When extending DC behavior:

- preserve explicit unsupported-topology handling;
- distinguish `0` from `null` / unavailable;
- keep fault detection deterministic;
- do not silently introduce hidden current limits or protective resistance;
- keep source voltage, load behavior, readings, and warnings conceptually separate;
- keep overload warnings recoverable when the circuit changes.

If `power.ts` gains another major responsibility, prefer extracting a focused module rather than extending a single large evaluator indefinitely.

Possible boundaries when justified:

```text
engine/dc/
    evaluateDc.ts
    seriesSolver.ts
    readings.ts
    limits.ts
```

Do not split files merely to reduce line count. Extract only when a responsibility becomes independently understandable and reusable.

## Digital Logic Boundaries

When implementing logic ICs:

- evaluate digital gates separately from the DC series solver;
- keep IC package/pin mapping separate from gate truth-table logic;
- use named pin definitions rather than magic numbers spread throughout UI code;
- require valid supply pins before treating the IC as powered;
- distinguish HIGH, LOW, floating/unknown, and fault states;
- keep gate evaluation pure where practical;
- preserve the physical IC package orientation independently from its logical truth table.

Recommended conceptual layers:

```text
engine/digital/
    logicLevels.ts
    gates.ts
    logicIcDefinitions.ts
    evaluateDigital.ts
```

A 7408, 7432, and 7404 should reuse common digital primitives rather than each receiving unrelated evaluation code.

## File Hotspots

Treat these files as architectural hotspots:

```text
frontend/src/store/useWorkspace.ts
frontend/src/scene/useSceneInteraction.ts
frontend/src/engine/power.ts
```

Before adding substantial new behavior to one of them, ask:

1. Does this responsibility already have a better module?
2. Is the new behavior component-specific?
3. Will another upcoming component need the same behavior?
4. Can the decision be implemented as a pure helper?
5. Will adding it here create another `if / else if` chain for every component type?

If yes, create the smallest meaningful extraction.

Do not perform broad refactors unrelated to the requested feature.

## Workspace State

Keep workspace state focused on user-controlled and persisted/session state.

Prefer derived electrical results over storing duplicated simulation state.

Good examples of stored state:

```text
component position
component rotation
wire endpoints
resistance selection
supply voltage
switch position
mount information
```

Good examples of derived state:

```text
current
voltage drop
LED brightness
terminal polarity
logic output
fault state
```

Avoid storing a value if it can be deterministically recalculated from the circuit.

## Scene Interaction

Do not make `useSceneInteraction.ts` a registry of every component-specific rule.

When new interaction complexity justifies it, extract focused behavior such as:

```text
scene/interactions/
    hitTesting.ts
    dragging.ts
    mounting.ts
    wiring.ts
    switching.ts
```

IC mounting should preferably reuse shared mounting primitives rather than adding a large DIP-specific branch directly to pointer handling.

## Mounting Rules

Electrical mounting validation belongs in domain/engine code, not JSX.

Keep these concerns separate:

```text
candidate discovery
mount validation
mount state update
visual mounted pose
```

Do not infer electrical connectivity from the visible mesh position alone.

Use stable socket IDs and named asset anchors.

## Readability

Prefer code that can be reviewed without mentally decoding it.

Avoid:

- deeply nested ternaries;
- multiple unrelated statements on one line;
- very long inline callbacks;
- unexplained magic numbers;
- repeated component-type condition chains;
- hidden side effects in helper functions;
- abbreviations that obscure electrical meaning.

Prefer:

```ts
const ledState = determineLedState(context);
const current = calculateSeriesCurrent(context);
const warning = determineSafetyWarning(reading);
```

over one large nested expression.

Prefer:

```ts
setVoltage(supply.a, voltage);
setVoltage(supply.b, 0);
```

over:

```ts
setVoltage(supply.a, voltage); setVoltage(supply.b, 0);
```

Use comments to explain *why* a non-obvious electrical or geometry rule exists, not to restate obvious syntax.

## Function Design

A function should have one understandable job.

When reviewing a large function, look for groups of operations that form distinct concepts such as:

```text
topology validation
path discovery
current calculation
voltage propagation
warning calculation
result formatting
```

Extract only when the resulting helper has a meaningful domain name and reduces cognitive load.

Avoid generic helper names such as:

```text
handleStuff
processData
doThing
utils
misc
```

## Constants and Ownership

Place constants near the domain that owns them.

Examples:

- resistor values belong with resistor definitions;
- LED forward-voltage assumptions belong with LED/DC assumptions;
- power-supply voltage constraints should not live in a resistor-only module;
- digital thresholds belong in the digital engine.

If a constant is used across multiple electrical domains, move it to a clearly named shared electrical module rather than an unrelated component file.

Avoid magic values such as:

```ts
2
0.02
0.25
0.001
```

when their physical meaning is important.

Prefer names such as:

```ts
LED_FORWARD_VOLTAGE
LED_OVERCURRENT_AMPS
DEFAULT_RESISTOR_POWER_WATTS
MOUNT_INSERTION_DEPTH
```

## Naming

Use lowercase kebab-case filenames for runtime assets.

Prefer:

```text
ic-7408-and.glb
ic-7432-or.glb
ic-7404-not.glb
buzzer.glb
```

Avoid:

```text
AND(IC).glb
OR(IC).glb
NOT(IC).glb
Buzzer.glb
```

Avoid spaces, parentheses, ambiguous abbreviations, and inconsistent casing in filenames.

Keep runtime IDs similarly stable and descriptive.

Do not rename stable Blender object names after runtime integration without updating all consumers, tests, and `docs/asset-contract.md`.

## TypeScript Quality

- Use TypeScript for application code.
- Avoid `any`.
- Prefer explicit domain types.
- Narrow discriminated unions using `modelId` or another stable discriminator.
- Keep pure calculations free of React dependencies.
- Handle `null` / unavailable states intentionally.
- Do not use non-null assertions merely to silence a design problem.
- Prefer exhaustive logic for important domain states.

When practical, keep the project compatible with TypeScript strict mode.

Do not weaken compiler settings to make a feature compile.

## Formatting and Style

Follow one consistent formatter once the repository adopts one.

Do not manually create a separate style convention for a new feature.

Keep diffs readable:

- one logical statement per line;
- stable import ordering consistent with nearby files;
- avoid formatting unrelated code while implementing a feature;
- do not combine a large formatting rewrite with behavioral work.

## Tests

New electrical components or behaviors should normally include:

1. pure domain/electrical tests;
2. mounting/topology tests;
3. browser interaction tests when the user-visible workflow materially changes.

For logic ICs also include truth-table coverage.

Example 7408 gate coverage:

```text
A B | Y
0 0 | 0
0 1 | 0
1 0 | 0
1 1 | 1
```

For 7432 and 7404, test every logical combination appropriate to the gate.

Test failure and recovery states where relevant:

```text
unpowered IC
floating input
wrong supply wiring
invalid mounting
component deletion
board deletion
faulted circuit
```

Do not remove, skip, loosen, or rewrite existing tests merely to accommodate a new implementation.

If a test must change because the product contract intentionally changed, update the contract documentation as part of the same change.

## Asset Contracts

Before modifying an integrated GLB contract, inspect:

```text
docs/asset-contract.md
```

Preserve:

- scale;
- orientation;
- anchor names;
- interactive mesh names;
- terminal IDs;
- physical spacing;
- mounting assumptions.

Source assets describe geometry and anchors.

TypeScript describes electrical behavior.

Do not encode truth tables, Ohm's law, circuit solving, or application state inside Blender.

## Documentation Governance

When a feature changes runtime behavior or an asset contract, inspect and update as applicable:

```text
AGENT.md
docs/asset-contract.md
frontend/README.md
```

Do not leave completed features listed as future work.

Do not describe a feature as implemented if only a source GLB exists.

Keep these distinctions explicit:

```text
asset exists
runtime-integrated
electrically simulated
browser-tested
```

Treat documentation drift as a code-quality issue.

## Change Scope

Prefer incremental changes.

Do not combine the following unless required by the feature:

```text
new behavior
large architecture rewrite
repository-wide formatting
dependency upgrades
asset renaming
unrelated cleanup
```

When a feature exposes an architectural weakness, make the smallest refactor needed to establish a clean boundary, then implement the feature.

Preserve unrelated user work.

## Dependencies

Do not add a dependency because it is fashionable or because another architecture commonly uses it.

Before adding one, determine:

- what problem it solves;
- why existing code is insufficient;
- runtime cost;
- maintenance cost;
- whether a small local implementation is clearer.

Do not introduce Zustand while the reducer architecture remains sufficient.

Do not introduce a general circuit solver or SPICE engine unless the product requirements actually require it.

## Code Review Checklist

Before considering a substantive code change complete, inspect:

### Architecture
- Does this logic belong in this file?
- Did the change blur rendering, state, and simulation boundaries?
- Did it significantly increase a known hotspot?
- Should a reusable domain helper exist?

### Types
- Did I add unrelated optional properties to `ComponentInstance`?
- Can invalid component states now be represented unnecessarily?
- Are null/unavailable states intentional?
- Are domain units clear?

### Electrical Behavior
- Is the graph still the connectivity source of truth?
- Did I accidentally ideal-union a load?
- Did I invent unsupported electrical values?
- Are DC and digital responsibilities separated?

### Readability
- Are there nested ternaries that should be named decisions?
- Are multiple operations compressed onto one line?
- Are physical constants named?
- Can another developer understand the algorithm without tracing UI code?

### Assets
- Are stable GLB names preserved?
- Is scale/orientation explicit?
- Are anchors the source of mounting geometry?
- Are runtime filenames consistent?

### Tests
- Is new domain behavior covered?
- Are mounting and invalid states covered?
- Is browser behavior covered when appropriate?
- Were existing tests preserved?

### Documentation
- Does `AGENT.md` still match the repository?
- Does `docs/asset-contract.md` match the implementation?
- Is the README accurate where user behavior changed?

## Completion Standard

A CircuitCube feature is maintainable when:

- its domain behavior has a clear home;
- invalid states are minimized by the type model;
- electrical evaluation remains independent of rendering;
- important logic is readable without decoding large expressions;
- tests describe the intended behavior;
- stable asset contracts remain documented;
- repository documentation describes the current implementation rather than an old roadmap.

Do not optimize for the fewest files or the fewest lines.

Optimize for a codebase that will still be understandable when CircuitCube includes resistors, LEDs, switches, buzzers, logic ICs, and eventually microcontrollers.
