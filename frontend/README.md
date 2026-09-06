# CircuitCube

A lightweight 3D electronics workspace built with React, TypeScript, Vite, Three.js, React Three Fiber, and Drei.

## Run locally

From this directory:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. `npm.cmd` avoids Windows PowerShell execution-policy restrictions; `npm` works in other shells.

The workspace starts with an unwired full-size breadboard, an off bench DC power supply, and an LED. State exists only for the current session: refreshing restores the demo. Wires and breadboard groups carry simplified logical power to correctly inserted LEDs. There are no voltage, current, resistor, or damage calculations.

## Controls

| Action                        | Control                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Add a component               | Click its library card, then click the grid                                    |
| Add without pointer placement | Use the card's **Add at view center** button                                   |
| Cancel placement              | Escape or Cancel                                                               |
| Select                        | Click a model or its entry under **On the workplane**                          |
| Move                          | Drag a component across the ground plane                                       |
| Keyboard move                 | Arrow keys move along world X/Z; one grid step with snapping, 0.1 step without |
| Rotate                        | R or Rotate; 90° around vertical Y; LEDs and slide switches turn by 180°                 |
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
| Toggle supply output          | Click its rocker or select it and use Output on/off                            |

Components move on the ground plane; mounted LEDs and slide switches follow their breadboard and arrow keys move them by socket positions. Each socket holds one wire endpoint, LED leg, or switch pin. Right-drag still pans while drawing wires. Short circuits and conflicting enabled supplies show a fault and suppress logical output until corrected. Keyboard shortcuts leave modified browser shortcuts and text-entry fields alone.

To light an LED, insert it with anode e11 and cathode e10. Wire supply + to top-positive-1 and supply − to top-negative-1. Add jumpers top-positive-2 to a11 and top-negative-2 to a10, then switch the supply on. Rail colors alone do not power a group.

The slide switch starts left, connecting pins 1 and 2. Right connects pins 2 and 3; pin 2 is common. Wire + and − to the outer pin groups to select common polarity. This does not reverse both supply leads. The full-size board's four rails each have two isolated 25-hole halves; bridge them explicitly when needed. The 400-hole board stays available in the library with continuous rails.

See the [asset and power contract](../docs/asset-contract.md) for anchor derivation, animation behavior, routing coordinates, and verification scenarios.

**Home** returns to a close, stable view of the breadboard and LED work area, with the power supply at the left edge. It does not zoom out when distant parts are added. **Fit All** frames every placed component, while **Focus selected** provides the closest inspection view.

## Assets and architecture

- The source assets remain in `../models/`. `npm run sync:models` copies the five catalog GLBs into `public/models/`; development and production builds run this automatically. The generated copies are ignored by Git.
- `src/lib/modelCatalog.ts` defines the typed catalog, asset URLs, and runtime transforms. `power.glb` retains its source filename.
- `src/scene/` owns loading, canvas, camera, and pointer interaction. `src/components/3d/` renders independent instances. `src/store/` owns React state and initialization; it contains no electrical simulation logic.
- Both breadboards, the supply, and LED use scale **0.1**. The slide switch uses scale **1** and **+90° X rotation** because its source pin pitch is already 2.54 mm. All render in a Y-up scene with an XZ ground plane. Bounds center each model horizontally and place its lowest point on the grid. Source geometry, materials, hierarchy, and named anchors are preserved.
- Minor workplane spacing stays fixed at **8.4 mm**, with major lines every ten steps. Socket targets and wire-bend snapping use **2.54 mm** pitch. Selection positions are shown in workplane grid steps. The demo centers the large board with a 20 mm bounds gap to the supply on the left and a 15 mm gap to the LED on the right.
- Assets load independently through [Drei's useGLTF](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf). Instances clone the hierarchy and share immutable mesh resources. Placement previews and animated LED materials belong to each instance. Supply displays use a local canvas texture without additional fonts or network requests.
- Thumbnail generation renders one offscreen frame per loaded model through the existing renderer, then keeps a static PNG. There is only one live WebGL canvas.
- Rendering runs on demand, with pixel density capped at 2. Camera clipping scales with viewing distance to prevent depth artifacts on the small assets. The 3D module loads separately from the interface; its Three.js bundle can produce Vite's size advisory.
- Failed assets have individual retry buttons. Initialization failures and lost WebGL contexts show a reload fallback.

## Verify

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

The Playwright checks use an isolated, headless Microsoft Edge session (`channel: 'msedge'`) and start Vite when needed. Install Edge or change the test channel to an installed Playwright browser on other systems. No signed-in browser profile is used.

The tests cover both board socket maps, split rails, slide-switch mounting and contact behavior, assets, LED mounting, wiring and bend editing, logical power and faults, switch interactions, independent materials, camera controls, narrow layouts, and loading/WebGL failures. Browser runs write screenshots to `artifacts/`; failed runs retain traces in `test-results/`. Under the edit-only development skill these commands are provided for the user and are not run automatically by the coding agent.

To test the production build in PowerShell:

```powershell
npm.cmd run build
$env:TEST_PRODUCTION = '1'
$env:TEST_BASE_URL = 'http://127.0.0.1:4173'
npm.cmd run test:e2e
Remove-Item Env:TEST_PRODUCTION, Env:TEST_BASE_URL
```
