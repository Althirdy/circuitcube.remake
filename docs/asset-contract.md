# Runtime asset and logical power contract

The source files are `models/breadboard.glb`, `models/power.glb`, and `models/led.glb`. All use the shared 0.1 runtime scale, Y-up orientation, and XZ workplane. Source geometry and names stay intact. Runtime objects clone the hierarchy and share geometry; animated materials belong to their individual instances.

## Breadboard and LED

The current breadboard has 400 sockets: 300 terminal sockets and four continuous 25-hole rails. `src/engine/breadboard.ts` records the inspected source coordinates, including the gaps between groups of five rail holes. `prepareModel` applies the visible model's scale and grounding transform to socket positions. Socket directions are +Y. Groups a–e share each numbered column, as do f–j; rail colors do not assign electrical polarity.

The old `scripts/create_breadboard.py` describes an 830-hole board and must not regenerate the current asset. No Blender generator or source GLB is changed for this runtime feature.

Mounted LEDs use adjacent numbered columns in one row. `LED_Anode_Pin` and `LED_Cathode_Pin` are shortened only by transforming cloned nodes; the flange stays 2 mm above the sockets and pins enter 2 mm. Detaching restores the original pin transforms. The two wire anchors retain their names and follow the shortened legs. Only `LED_Lens` and `LED_Dome` receive cloned emissive materials for logical illumination.

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

For conflict detection, structural circuit membership includes mounted LED connections and enabled supply pairs. Two enabled sources sharing that circuit suppress output, even if the connection shares only one conducting network. A wire-only positive-to-negative path is a short; shorts take precedence over multiple-source faults. Disabled sources do not generate power or bridge their terminals. Faults recalculate without latching when wiring or switch states change. Fault suppression is confined to the affected circuit.

## User-run verification

The edit-only development skill leaves execution to the user:

```powershell
cd C:\Users\PC\Desktop\circuitcube\frontend
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

The power tests cover circuit states, source conflicts, occupancy, cleanup, asset-derived anchors, transforms, per-instance materials, switch timing, and browser workflows. Browser tests also write powered workspace, LED, and narrow-screen screenshots under `frontend/artifacts/` when run.

For manual acceptance, insert an LED with anode e11 and cathode e10. Connect supply + to top-positive-1 and supply − to top-negative-1; add jumpers top-positive-2 → a11 and top-negative-2 → a10. Toggle the supply and inspect the rocker, ON display and LED. Flip the LED, remove either lead, and temporarily bridge the two rails to check off and fault feedback. Try moving and rotating the supply and board, changing bends, deleting a supply, and repeating with an independent second circuit.
