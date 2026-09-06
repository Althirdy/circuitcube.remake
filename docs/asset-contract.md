# Runtime asset and logical power contract

The catalog loads `breadboard.glb`, `breadboard-large.glb`, `power.glb`, `led.glb`, and `slide-switch.glb` from `models/`. Both breadboards, the power supply, and LED use scale 0.1 with their existing orientation. The slide switch uses scale 1 and a +90° X rotation: its source −Z axis becomes upright +Y. The workspace remains Y-up with an XZ workplane. Source geometry and names stay intact. Runtime objects clone the hierarchy and share geometry; animated materials belong to their individual instances.

## Breadboard and LED

The half-size breadboard has 400 sockets: 300 terminal sockets and four continuous 25-hole rails. `src/engine/breadboard.ts` records the inspected source coordinates, including the gaps between groups of five rail holes. `prepareModel` applies the visible model's scale and grounding transform to socket positions. Socket directions are +Y. Groups a–e share each numbered column, as do f–j; rail colors do not assign electrical polarity.

The full-size board has 830 sockets: 63 columns × 10 terminal rows plus four 50-hole rails. Each rail has separate left/right 25-hole connection groups; a jumper is required across its center separator. Stable IDs are a1–j63 and, for example, top-positive-1–top-positive-50. The two halves use group IDs such as `top-positive-left` and `top-positive-right`.

Measured raw terminal X centers start at −0.7874 for the large board and −0.3683 for the small board, incrementing by 0.0254. Both use raw Y 0.04015 and row Z values [0.1476, 0.1222, 0.0968, 0.0714, 0.046, −0.046, −0.0714, −0.0968, −0.1222, −0.1476]. Large rail half origins are −0.7028 and +0.0372; within each half, X adds `floor(i / 5) * 0.141 + (i % 5) * 0.0254` for i=0–24. Rail Z values remain ±0.192 and ±0.227. The 7.44 mm center gap matches the four `Rail_Center_Separator` meshes. All coordinates undergo the same runtime scale, centering, grounding and instance rotation as the visible asset.

The old `scripts/create_breadboard.py` is not authoritative for either exported GLB and must not regenerate them. No Blender generator or source GLB is changed for this runtime feature.

Mounted LEDs use adjacent numbered columns in one row. `LED_Anode_Pin` and `LED_Cathode_Pin` are shortened only by transforming cloned nodes; the flange stays 2 mm above the sockets and pins enter 2 mm. Detaching restores the original pin transforms. The two wire anchors retain their names and follow the shortened legs. Only `LED_Lens` and `LED_Dome` receive cloned emissive materials for logical illumination.

## Mounted slide switch

`SlideSwitch_Anchor_1`, `_2`, and `_3` have source positions (−0.00254, 0, 0.0035), (0, 0, 0.0035), and (+0.00254, 0, 0.0035). Their 2.54 mm spacing is already physical size. A rigid mounted transform places the prepared common anchor 2 mm below the middle socket surface; it aligns all three anchors without shortening or scaling any pin or body mesh.

`ComponentInstance.switchMount` stores the board ID and an ordered tuple of socket IDs for pins 1, 2, 3. Triples must be adjacent columns in one terminal row, free of other wire endpoints or mounted legs. Rails, out-of-range columns, and trench orientations are invalid. Rotating a mount reverses the tuple; it does not relabel pins or change switch state. Both board sizes resolve their own socket definitions. Mounted switches follow board transforms, arrow keys relocate by sockets, and invalid pointer drops restore the previous mount. Detaching or deleting frees the holes; deleting a board detaches its switches and LEDs at their last world XZ position. Loose switch pins are not wire endpoints.

`switchPosition` defaults to `left` (1 ↔ 2); `right` connects 2 ↔ 3. The common pin is always 2. Each toggle updates one pair atomically before recomputing logical power and faults. State survives relocation, rotation and detachment. It selects one connection's polarity rather than reversing two circuit leads.

Animate `SlideSwitch_Slider` and `SlideSwitch_Slider_Grip` together using their initial offsets and the delta between `SlideSwitch_Slider_Left_Anchor` and `SlideSwitch_Slider_Right_Anchor`: source X −0.00125 to +0.00125. Apply the delta in each mesh parent's coordinates over 150 ms. Housing, pins and anchor nodes stay stationary. Only cloned node transforms change, with no owned material or geometry resources. Reduced motion jumps to the target; rapid toggles resume from the current interpolated position. Cleanup restores the cloned moving nodes. Selected contact pairs and common polarity appear in the selection panel and slider hover feedback.

## Power terminals

The inspected power supply front faces +Z. It contains terminal metal meshes but no exported wire anchors. During asset preparation, create these anchors on the prepared object before exposing terminal metadata:

| Terminal ID | Named source mesh | Runtime anchor |
| --- | --- | --- |
| `positive` | `Positive_Terminal_Metal` | `Positive_Wire_Anchor` |
| `negative` | `Negative_Terminal_Metal` | `Negative_Wire_Anchor` |

Each anchor is the center of the metal mesh's front face: transformed bounds center X/Y and maximum Z, converted to the prepared root's local coordinates. Directions are +Z and rotate with the component. The matching `Positive_Terminal_Base` and `Negative_Terminal_Base` are also pickable. Terminal references retain `{ componentId, terminalId }`. A terminal holds one wire endpoint; leads connect to breadboard sockets in either drawing direction.

Wires enter terminal faces by 1 mm and leave along their outward direction for 5 mm. Breadboard leads enter by 1 mm and leave vertically. Intermediate bends are local to the source component. Supply-source heights are relative to the workplane; breadboard-source heights are relative to the socket surface. Heights start at 5 mm and are editable from 2–30 mm. Connector exits stay at their physical positions even when bend heights change.

## Switch and display

`Power_Switch` is the rocker and its existing mesh origin is the pivot. Rotate its local X axis from the source rest rotation minus 8° (off) to plus 8° (on), easing over 180 ms. `Power_Switch_Housing` stays stationary. A stationary left-click toggles output; movement beyond the component drag threshold moves the supply without toggling it.

Hide `Display_Voltage` and `Display_Unit` on prepared copies, preserving both named source meshes. Add a `Power_Output_Display` plane just in front of `Display_Glass`, sized from its transformed bounds. Its local canvas texture says ON and fades over 150 ms. This is a logical output indicator, not a numeric readout. On faults the rocker remains in its requested position but output and the ON display are suppressed.

LED lens/dome emission fades over 150 ms between off and a fixed red emissive intensity. Reduced motion applies end states immediately. Animation requests frames only while transitioning and stops when settled. Instance-owned materials, display geometry, and textures are disposed when the instance is replaced or removed.

## Logical circuit model

`ComponentInstance.outputEnabled` is session-only requested switch state; missing values mean off. Pure TypeScript derives supply, terminal-network, and LED status from placed instances, breadboard groups, and completed wires. Draft wires do not participate. LEDs never union their two conductive networks.

An LED lights only when its anode and cathode reach the positive and negative terminals of the same enabled, fault-free supply. No current flows through chains of LEDs in this milestone. There are no voltage, resistance, current, thermal, or brightness calculations.

For conflict detection, structural circuit membership includes mounted LED connections and enabled supply pairs. Two enabled sources sharing that circuit suppress output, even if the connection shares only one conducting network. A conducting positive-to-negative path through wires, board groups, or selected switch contacts is a short; shorts take precedence over multiple-source faults. Disabled sources do not generate power or bridge their terminals. Faults recalculate without latching when wiring or switch states change. Fault suppression is confined to the affected circuit.

## User-run verification

The edit-only development skill leaves execution to the user:

```powershell
cd C:\Users\PC\Desktop\circuitcube\frontend
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

The socket tests match all 400 and 830 targets against the actual contact meshes. Slide-switch tests cover split rails, mixed boards, rigid seating, occupancy, relocation, reversal, detachment, cleanup, contact selection, independent visual state, physical demo gaps, and browser controls. The power tests cover circuit states, source conflicts, occupancy, cleanup, asset-derived anchors, transforms, per-instance materials, switch timing, and browser workflows. Browser tests also write powered workspace, LED, and narrow-screen screenshots under `frontend/artifacts/` when run.

For slide-switch acceptance, mount it in e10–e12. Connect supply + to a10 and supply − to a12. Mount an LED elsewhere (for example anode h20, cathode h21), then wire b11 → j20 and b12 → j21. Enable the supply: left lights the LED; right connects common to negative and turns the LED off. Neither position should short the supply. Feed one large rail half and confirm the other half remains unpowered until bridged. Repeat mounting on the small board, rotate and move each board, detach and delete mounts, and inspect desktop/narrow-screen controls.

For direct LED acceptance, insert an LED with anode e11 and cathode e10. Connect supply + to top-positive-1 and supply − to top-negative-1; add jumpers top-positive-2 → a11 and top-negative-2 → a10. Toggle the supply and inspect the rocker, ON display and LED. Flip the LED, remove either lead, and temporarily bridge the two rails to check off and fault feedback. Try moving and rotating the supply and board, changing bends, deleting a supply, and repeating with an independent second circuit.
