# CircuitCube

A lightweight 3D electronics workspace built with React, TypeScript, Vite, Three.js, React Three Fiber, and Drei.

## Run locally

From this directory:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. `npm.cmd` avoids Windows PowerShell execution-policy restrictions; `npm` works in other shells.

The workspace starts with an unwired full-size breadboard, an off bench DC power supply, and an LED. State exists only for the current session: refreshing restores the demo. The basic DC engine calculates current and resistor power in a series circuit with one supply, resistors, and optionally one LED. Unsupported branched loads are labeled explicitly. Overload warnings recover automatically; there is no permanent damage or thermal simulation.

## Controls

The top-bar Light/Dark switch follows your system theme until you choose a mode, then remembers that choice locally. Changing theme preserves the current circuit, camera and wiring operation. Electrical component colors and chosen wire colors do not change.

The right library groups parts into Boards, Power, Basic components and Logic ICs. Only Boards starts open. On the workplane and Jumper wires start collapsed, show counts even when empty, and keep selected-item indicators visible. Expand their headers to select a component or wire; collapsing never hides circuit objects. Disclosure choices last for the session.

IC guides include a labeled top-view picture: pin 14 is VCC (+5 V), pin 7 is GND (0 V / supply −), and the notch identifies the pin-1 end. The picture is a fixed reference rather than the camera view; socket labels follow mounting and rotation. These polarity labels describe intended connections, while the inspector reports live states.

Open **Pin picture · find VCC (+) and GND (−)** inside the wiring guide to see the diagram. Wiring steps stay above it. On smaller screens, the persistent guide starts collapsed. Inspectors, warnings and the guide share one bounded scroll area so editing controls do not sit behind another panel.

| Action                        | Control                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Add a component               | Click its library card, then click the grid                                    |
| Add without pointer placement | Use the card's **Add at view center** button                                   |
| Cancel placement              | Escape or Cancel                                                               |
| Select                        | Click a model or its entry under **On the workplane**                          |
| Move                          | Drag a component across the ground plane                                       |
| Keyboard move                 | Arrow keys move along world X/Z; one grid step with snapping, 0.1 step without |
| Rotate                        | R or Rotate; 90° around vertical Y; LEDs, resistors, ICs and slide switches turn by 180° |
| Delete                        | Delete key or Delete button                                                    |
| Orbit                         | Left-drag empty workspace                                                      |
| Pan                           | Right-drag or Shift + left-drag                                                |
| Zoom                          | Scroll wheel or the + / − buttons                                              |
| Frame                         | Home, Top, Front, Fit All, or Focus selected                                   |
| Deselect                      | Click empty workspace or Escape                                                |
| Wire                          | Click a free socket or supply terminal, then another free endpoint             |
| Add a wire bend               | Stationary right-click, Enter, or Add bend while drawing                       |
| Edit a wire                   | Select the wire; drag bend handles, edit height/color, or right-click a segment |
| Insert an LED                 | Place or drag onto adjacent numbered holes in one terminal row                 |
| Detach an LED                 | Drag onto empty ground or use Detach LED                                       |
| Insert a slide switch         | Place or drag three pins onto adjacent numbered columns in one terminal row    |
| Switch position               | Click the slider/grip or use the selected component's Switch position button   |
| Detach a slide switch         | Drag onto empty ground or use Detach switch                                    |
| Insert a resistor             | Place five column intervals apart in one terminal row, such as e10–e15        |
| Insert a logic IC             | Click over the center gap at the first of seven free columns (rows e/f)       |
| Move a mounted IC             | Left/Right shifts a column; R turns 180°; drag onto ground or Detach IC to remove |
| Inspect an IC                 | Select it for the wiring guide, numbered pin map, states and fault explanations |
| Resistance                    | Select 220 Ω through 10 kΩ in the component panel                              |
| Supply voltage                | Edit 0–12 V in 0.1 V steps, or choose a preset                                  |
| Wire readings                 | Select a wire for endpoint highlights, potential and available current          |
| Toggle supply output          | Click its rocker or select it and use Output on/off                            |

Components move on the ground plane; mounted LEDs, resistors and slide switches follow their breadboard and arrow keys move them by socket positions. Each socket holds one wire endpoint, LED leg, resistor lead, or switch pin. Right-drag still pans while drawing wires. Short circuits and conflicting enabled supplies show a fault and suppress logical output until corrected. Keyboard shortcuts leave modified browser shortcuts and text-entry fields alone.

To light an LED, mount a 330 Ω resistor in e10–e15 and an LED with anode h20/cathode h21. Wire supply + to a10, a15 to j20, and j21 to supply −. Enable 5 V output: expect about 9.1 mA and 0.027 W in the resistor. At 12 V, LED current and resistor dissipation exceed the model's ratings and warnings suppress glow. Selecting 1 kΩ clears both warnings. Rail colors alone do not power a group.

The LED model assumes a 2 V forward drop and warns above 20 mA. Resistors have a fixed 0.25 W rating and ±5% displayed tolerance; calculations use nominal values. 1 kΩ means 1,000 Ω. Selected-wire voltage is relative to the associated supply negative terminal. Ambiguous current through redundant wiring is marked unavailable, never fabricated.

The slide switch starts left, connecting pins 1 and 2. Right connects pins 2 and 3; pin 2 is common. Wire + and − to the outer pin groups to select common polarity. This does not reverse both supply leads. The full-size board's four rails each have two isolated 25-hole halves; bridge them explicitly when needed. The 400-hole board stays available in the library with continuous rails.

See the [asset and power contract](../docs/asset-contract.md) for anchor derivation, animation behavior, routing coordinates, and verification scenarios.

**Home** returns to a close, stable view of the breadboard and LED work area, with the power supply at the left edge. It does not zoom out when distant parts are added. **Fit All** frames every placed component, while **Focus selected** provides the closest inspection view.

## Assets and architecture

- The source assets remain in `../models/`. `npm run sync:models` copies the nine catalog GLBs into `public/models/`; development and production builds run this automatically. The generated copies are ignored by Git.
- `src/lib/modelCatalog.ts` defines the typed catalog, asset URLs, and runtime transforms. `power.glb` retains its source filename.
- `src/scene/` owns loading, canvas, camera, and pointer interaction. `src/components/3d/` renders independent instances. `src/store/` owns React state and initialization; it contains no electrical simulation logic.
- Both breadboards, the supply, and LED use scale **0.1**. The slide switch and resistor use scale **1** and **+90° X rotation** because these assets already use physical dimensions. Switch pins have 2.54 mm pitch and resistor endpoints span 12.7 mm. All render in a Y-up scene with an XZ ground plane. Bounds center each model horizontally and place its lowest point on the grid. Source geometry, materials, hierarchy, and named anchors are preserved.
- Minor workplane spacing stays fixed at **8.4 mm**, with major lines every ten steps. Socket targets and wire-bend snapping use **2.54 mm** pitch. Selection positions are shown in workplane grid steps. The demo centers the large board with a 20 mm bounds gap to the supply on the left and a 15 mm gap to the LED on the right.
- Assets load independently through [Drei's useGLTF](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf). Instances clone the hierarchy and share immutable mesh resources. Placement previews and animated LED materials belong to each instance. Supply displays use a local canvas texture without additional fonts or network requests.
- Thumbnail generation renders one offscreen frame per loaded model through the existing renderer, then keeps a static PNG. There is only one live WebGL canvas.
- Rendering runs on demand, with pixel density capped at 2. Camera clipping scales with viewing distance to prevent depth artifacts on the small assets. The 3D module loads separately from the interface; its Three.js bundle can produce Vite's size advisory.
- Failed assets have individual retry buttons. Initialization failures and lost WebGL contexts show a reload fallback.

## Verify

The 7408 AND, 7432 OR and 7404 NOT ICs are implemented with authored tests; build/test/browser execution is pending user verification. Set the supply to 5 V, connect VCC pin 14 and GND pin 7, then connect the gate’s inputs to HIGH (+5 V) or LOW (ground). The inspector suggests free holes beside the pins. Use a slide switch to select an input and chain outputs into other gates as needed. A HIGH output can light a resistor/LED path to ground; a LOW output can sink a path from VCC. Always include a limiting resistor.

ICs use an educational TTL model, with four explicit states: HIGH, LOW, UNKNOWN and FAULT. Floating inputs and feedback loops are unresolved; conflicting drivers are faults. Outputs are idealized, and package current limits, fan-out and timing are not simulated. IC supply current readings are unavailable; supported output-load currents are calculated. Each output supports one series resistor/LED path. IC source assets use scale 0.01 with no axis rotation. Their cloned pins spread to fit the boards’ center gap; source geometry remains intact. See the asset contract for exact mounting and electrical limits.

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

The Playwright checks use an isolated, headless Microsoft Edge session (`channel: 'msedge'`) and start Vite when needed. Install Edge or change the test channel to an installed Playwright browser on other systems. No signed-in browser profile is used.

The tests cover both board socket maps, split rails, slide-switch mounting and contact behavior, assets, LED mounting, wiring and bend editing, series current and overload recovery, wire readings, source faults, switch interactions, independent materials, camera controls, narrow layouts, and loading/WebGL failures. Browser runs write screenshots to `artifacts/`; failed runs retain traces in `test-results/`. Under the edit-only development skill these commands are provided for the user and are not run automatically by the coding agent.

To test the production build in PowerShell:

```powershell
npm.cmd run build
$env:TEST_PRODUCTION = '1'
$env:TEST_BASE_URL = 'http://127.0.0.1:4173'
npm.cmd run test:e2e
Remove-Item Env:TEST_PRODUCTION, Env:TEST_BASE_URL
```
