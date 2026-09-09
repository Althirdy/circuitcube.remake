# Runtime asset and basic DC contract

The catalog loads `breadboard.glb`, `breadboard-large.glb`, `power.glb`, `led.glb`, `slide-switch.glb`, `resistors.glb`, `ic-7408-and.glb`, `ic-7432-or.glb`, and `ic-7404-not.glb` from `models/`. Both breadboards, the power supply, and LED use scale 0.1 with their existing orientation. The slide switch and resistor use scale 1 and a +90° X rotation: its source −Z axis becomes upright +Y. ICs use scale 0.01 and no axis rotation. The workspace remains Y-up with an XZ workplane. Source geometry and names stay intact. Runtime objects clone the hierarchy and share geometry; animated materials belong to their individual instances.

## 74xx IC packages and digital simulation

The 7408 (four AND gates), 7432 (four OR gates), and 7404 (six inverters) are runtime-integrated with domain and browser test cases authored. Execution of builds and tests is pending user verification. Their formerly unused uppercase source filenames have been normalized; internal `IC7408`, `IC7432`, and `IC7404` prefixes and all named nodes are preserved.

Each asset exposes `ICxxxx_Anchor_1` through `_14`, `ICxxxx_Pin_1` through `_14`, body, notch, and pin-1 dot. Raw anchor pitch is 0.254 and row separation is 0.762; at scale 0.01 these become 2.54 mm and 7.62 mm. The existing boards have 9.2 mm between e/f socket centers. Mounted copies therefore translate each pin and its anchor outward by 0.79 mm, using transformed anchor positions to fit the actual socket separation. Bodies and shared geometry are unchanged. Detachment uses a fresh unseated clone. This intentionally replaces the originally proposed rigid package seating, which cannot align these two existing assets.

`IcMount.pins` is an ordered 14-entry tuple, indexed by physical pin number minus one. At the default orientation it maps `[eN … e(N+6), f(N+6) … fN]`; 180° rotation swaps the two seven-entry halves. The center of opposing corner anchors determines the pose, with anchors inserted 2 mm beneath the socket surface. Only rows e/f and seven consecutive in-range columns are valid. All 14 sockets are reserved. Rails, occupied sockets and out-of-range candidates are rejected. Left/Right shifts by a column; Up/Down retains the mount and explains the trench constraint. Invalid pointer drops preserve the previous mount; board transforms carry packages; detaching or deleting a board preserves world position and orientation. Loose IC pins cannot be wired.

Package definitions live in `engine/digital/logicIcDefinitions.ts`, separate from truth tables and geometry. VCC is pin 14 and GND is pin 7. AND/OR gates use inputs/output 1,2→3; 4,5→6; 9,10→8; 12,13→11. NOT gates use 1→2, 3→4, 5→6, 9→8, 11→10, 13→12. The circuit graph aliases pins to mounted socket nodes without joining package pins or treating a gate as a passive load.

Operation requires VCC and GND connected through ideal wiring to one enabled, fault-free supply, with 4.75–5.25 V on VCC and that supply’s negative on GND. Direct inputs at 0–0.8 V are LOW, 2 V through VCC are HIGH, between thresholds or floating are UNKNOWN, and outside the supply range are FAULT. Different supply references are rejected. Resistor-derived input levels, pull-ups/down, timing, fan-out, output-current limits and quiescent/input current are not modeled. A LOW AND input determines LOW and a HIGH OR input determines HIGH even with an unknown companion; faults propagate explicitly.

Combinational outputs are resolved through gate dependencies, including multiple packages. Feedback cycles remain UNKNOWN. More than one powered output on a net is a fault even if their values agree. An output contradicting an ideal rail is a fault. Faulted supply rails invalidate every attached IC. Faults are recalculated on every layout or switch change, with no stored damage or latched logic state.

HIGH outputs ideally drive VCC and LOW outputs ideally drive GND. A separate output-load evaluator supports one series load path per output: one or more resistors and optionally one LED, with HIGH sourcing to ground or LOW sinking from VCC. It reuses the educational 2 V LED assumption, 20 mA warning threshold, nominal resistance and 0.25 W resistor default. Missing resistors, overloaded LEDs/resistors, branches, loops, multiple LEDs and different-reference loads get explicit diagnostics; unresolved values stay null. General parallel analog solving and output-to-output load paths are unsupported. Output load current and available wire potentials are derived; IC supply-wire current is unavailable because internal package currents are not modeled. Bench-only circuits continue through the existing series solver.

The selection panel includes top-level Focus/Detach/Close actions, live gate-1 states, mounting guidance and a collapsible accessible 14-pin table with current socket names after rotation, per-pin state/voltage and expandable reasons. A dismissible wiring guide remains available when the learner selects a wire or another component. Suggested wiring holes use free sockets on the same electrical strip and update as holes become occupied; already connected wires need not move. The guide names LED anode/cathode explicitly and offers the alternate sink arrangement in an expandable section. UNKNOWN is explained as undetermined, distinct from LOW.

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

Hide `Display_Voltage` and `Display_Unit` on prepared copies, preserving both named source meshes. Add a `Power_Output_Display` plane just in front of `Display_Glass`, sized from its transformed bounds. Its local canvas texture shows the selected voltage to one decimal place with a V suffix, and fades over 150 ms. A per-instance texture updater redraws only when voltage changes. Supply voltage defaults to 5 V, accepts 0–12 V in 0.1 V steps, and is editable through the selection panel and 3.3/5/9/12 V presets. Invalid input keeps the last valid setting. On faults the rocker remains in its requested position but output and the voltage display are suppressed. Voltage and current knobs remain noninteractive.

LED lens/dome emission fades over 150 ms between off and a current-derived red emissive intensity, proportional to current up to a 20 mA reference. Overcurrent or resistor overload suppresses glow. Reduced motion applies end states immediately. Animation requests frames only while transitioning and stops when settled. Instance-owned materials, display geometry, and textures are disposed when the instance is replaced or removed.

## Resistor model and mounting

`resistor` uses the single `resistors.glb` asset. The root, body, four separate band meshes, both horizontal leads, both downward leads, and named anchors remain intact. Raw `Resistor_Left_Anchor` and `Resistor_Right_Anchor` positions are (−0.00635, 0, 0) and (+0.00635, 0, 0). The prepared model's anchor midpoint aligns to the socket midpoint, 1 mm below the socket surface. This leaves approximately 0.85 mm beneath the body without deforming either lead.

A resistor mount stores a board ID and two ordered socket IDs, five numbered-column intervals apart in one row. Only its endpoints occupy holes. Rails, out-of-bounds spans, mixed rows and occupied endpoints are rejected. Rotation reverses the pin tuple; resistance is non-polarized. Moving a board carries the resistor; arrow keys relocate sockets; invalid pointer drops roll back; detachment and board deletion preserve world XZ position and resistance. Loose pins cannot be wired.

Resistance choices are 220, 330, 470, 1000, 4700 and 10000 ohms; 330 ohms is the default. Tolerance is fixed at ±5% and rating at 0.25 W. Recolor `Resistor_Band_1` through `_4` with two significant digits, multiplier and gold tolerance. Clone only those band materials per instance; the body, leads and geometry stay shared. Thumbnail rendering applies the default code on a temporary clone and disposes its band materials afterward.

## Series DC circuit model

`ComponentInstance.outputEnabled` is session-only requested switch state; missing values mean off. Pure TypeScript derives supply, terminal-network, and LED status from placed instances, breadboard groups, and completed wires. Draft wires do not participate. LEDs never union their two conductive networks.

The pure engine supports one enabled supply, one or more series resistors, and optionally one LED per independent circuit. Resistors and LEDs connect distinct electrical nodes, never ideal-union their endpoints. Use the educational red-LED approximation Vf=2 V, nominal resistance, and I=max(0, Vs−Vf)/ΣR. Resistor-only circuits use I=Vs/ΣR. Resistor drop is I×R and dissipation is I²R. Reversed LEDs, open returns, disabled supplies and insufficient forward voltage carry zero current. A zero-bias series ring connected to only one supply pole also carries zero current. General parallel loads and multiple LEDs in one circuit are unsupported, with glow suppressed and numerical readings unavailable.

Forward LEDs with no limiting resistance at an applied voltage above 2 V show Missing current-limiting resistor with unknown current. No infinity, arbitrary current, or hidden protective resistor is invented. Current above 20 mA warns on the LED; dissipation above 0.25 W warns on the resistor. Either overload suppresses circuit LED glow, while numerical estimates remain visible as estimated unsafe operating values. Correcting voltage, resistance, wiring or switch position clears warnings automatically. There is no latching damage, temperature model, tolerance randomization, or source current limit.

For conflict detection, structural circuit membership includes mounted LED and resistor connections and enabled supply pairs. Two enabled sources sharing that circuit suppress output, even if the connection shares only one conducting network. A conducting positive-to-negative path through wires, board groups, or selected switch contacts is a short; shorts take precedence over multiple-source faults. Disabled sources do not generate power or bridge their terminals. Faults recalculate without latching when wiring or switch states change. Fault suppression is confined to the affected circuit.

## Selected-wire readings

Selected wires retain their chosen color, gain a blue outline and endpoint markers, and retain bend-editing controls. Voltage means potential relative to the associated source's negative terminal. An ideal wire has no endpoint voltage drop. Floating potentials remain null rather than becoming zero.

The engine retains a graph of physical junctions and ideal wire/switch edges before collapsing ideal nets. A wire that is a bridge has a unique current equal to the net current injection on one side. Unused branches therefore read zero. Redundant ideal loops have indeterminate per-wire current; the panel says Current unavailable rather than dividing current arbitrarily. Unsupported and faulted circuits omit numerical values and show the reason. Numerical zero and unavailable/null remain distinct. There are no current arrows or continuously animated indicators.

## User-run verification

The workspace UI adds independent library accordions, semantic light/dark slate-and-teal themes, and an SVG IC reference diagram. `categoryByModel` owns catalog grouping. Expansion state belongs to the sidebar, and theme preference is stored separately under `circuitcube.theme`; neither enters the circuit layout. The canvas background/grid and interaction highlights follow the active theme without remounting the canvas. GLB materials, resistor bands, LED behavior, source transforms and wire color choices remain electrical/asset properties rather than theme colors. Thumbnails retain a neutral light backdrop.

The IC diagram derives roles and sockets from the existing definitions and mount tuple. It is always notch-up, with pin 1 upper-left, pin 14 upper-right, and pin 7 lower-left. Rotation changes socket annotations without rotating the diagram or its text. VCC/GND labels are intended connections, not simulated state. An SVG description and the existing pin table provide text equivalents. UI tests are authored; their execution remains user-run.

Wiring steps precede a collapsible pin-picture disclosure. The persistent guide starts collapsed on narrow screens. Inspectors, warnings and persistent guidance occupy one bounded scrolling stack. Accordion headers expose their counts, selection and load-error metadata to assistive technology. The senior UI/UX source review scored 7.8/10 initially and 9.0/10 after one revision round; this is a heuristic assessment, not browser verification.

The edit-only development skill leaves execution to the user:

```powershell
cd C:\Users\PC\Desktop\circuitcube\frontend
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

The socket tests match all 400 and 830 targets against the actual contact meshes. Slide-switch tests cover split rails, mixed boards, rigid seating, occupancy, relocation, reversal, detachment, cleanup, contact selection, independent visual state, physical demo gaps, and browser controls. Resistor tests cover asset anchors, mounting spans, occupancy, color bands and independent materials. DC tests cover series loads, overload boundaries and recovery, unsupported topologies, wire potentials, unused branches and redundant loops. The power tests cover circuit states, source conflicts, occupancy, cleanup, asset-derived anchors, transforms, per-instance materials, switch timing, and browser workflows. Browser tests also write powered workspace, resistor, LED, and narrow-screen screenshots under `frontend/artifacts/` when run.

For slide-switch acceptance, mount it in e10–e12. Connect supply + to a10 and supply − to a12. Mount a 330 Ω resistor in e40–e45 and an LED with anode h20, cathode h21. Wire b11 → a40, a45 → j20, and b12 → j21. Enable the supply: left lights the LED; right connects common to negative and turns the LED off. Neither position should short the supply. Feed one large rail half and confirm the other half remains unpowered until bridged. Repeat on the small board using resistor e20–e25 and wires b11 → a20 and a25 → j20 instead. Rotate and move each board, detach and delete mounts, and inspect desktop/narrow-screen controls.

For basic DC acceptance, mount a 330 Ω resistor in e10–e15 and LED anode h20/cathode h21. Connect supply + → a10, a15 → j20, and j21 → supply −. At 5 V expect 9.09 mA and 0.027 W. At 12 V expect 30.30 mA and 0.303 W with both warnings; changing to 1 kΩ recovers to 10 mA and 0.1 W. Inspect selected wire potentials before and after the resistor. Flip the LED, remove either lead, and temporarily bridge the supply rails to check off and fault feedback. Try moving and rotating the supply and board, changing bends, deleting a supply, and repeating with an independent second circuit.
