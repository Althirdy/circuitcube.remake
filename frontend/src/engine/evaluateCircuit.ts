import type { Layout, SocketSource, TerminalDefinition } from '../types/workspace';
import { adjacency, circuitGraph, idealWireCurrent } from './circuitGraph';
import { evaluatePower } from './power';
import { evaluateDigital } from './digital/evaluateDigital';
import { evaluateOutputLoads } from './digital/outputLoads';

export function evaluateCircuit(layout: Layout, sockets: SocketSource, terminals: TerminalDefinition[]) {
  const graph = circuitGraph(layout, sockets, terminals);
  const digital = evaluateDigital(layout, graph);
  if (!Object.keys(digital.chips).length) return { power: evaluatePower(layout, sockets, terminals), digital };
  const loads = evaluateOutputLoads(graph, digital);
  const power = evaluatePower({ ...layout, instances: layout.instances.filter(instance => !loads.handled.has(instance.id)) }, sockets, terminals);
  // Keep structural source conflicts even when their passive loads were handed
  // to the output evaluator rather than the bench-only solver.
  for (const source of graph.supplies.filter(source => source.instance.outputEnabled)) {
    const enabled = graph.supplies.filter(other => other.instance.outputEnabled && graph.circuits.find(other.a) === graph.circuits.find(source.a));
    if (enabled.some(other => other.a === other.b)) power.supplies[source.instance.id] = 'short-circuit';
    else if (enabled.length > 1) power.supplies[source.instance.id] = 'multiple-supplies';
  }
  Object.assign(power.components, loads.components);
  Object.assign(power.leds, loads.leds);
  const readings = new Map([...digital.nets, ...loads.nets]);
  const idealGraph = adjacency(graph.ideal);
  const icSupplyIds = new Set(digital.outputs.map(driver => driver.supplyId).filter(id => id !== null));
  for (const [key, node] of graph.terminalNodes) {
    const reading = readings.get(graph.nets.find(node));
    if (!reading) continue;
    power.terminals[key] = reading.level === 'fault' ? 'fault' : reading.voltage === null ? 'unconnected' : reading.voltage === 0 ? 'negative' : reading.level === 'high' ? 'positive' : 'voltage';
  }
  for (const wire of layout.wires) {
    const edge = graph.ideal.find(edge => edge.id === `wire:${wire.id}`);
    if (!edge) continue;
    const net = graph.nets.find(edge.a);
    const reading = readings.get(net);
    if (!reading) continue;
    const isRail = digital.railNets.has(net);
    const hasIcSupply = reading.supplyId !== null && icSupplyIds.has(reading.supplyId);
    const unknownCurrent = reading.voltage === null || reading.level === 'fault' || loads.uncertainNets.has(net) || (isRail && hasIcSupply);
    const calculated = unknownCurrent ? null : idealWireCurrent(edge, idealGraph, loads.injections);
    const previous = power.wires[wire.id];
    // Package input/quiescent current is not modeled, so do not display a
    // fabricated bench-supply total. Output load currents remain measurable.
    const current = isRail && !hasIcSupply ? previous?.current ?? null : calculated === null ? null : Math.abs(calculated);
    power.wires[wire.id] = {
      voltage: reading.voltage, current, supplyId: reading.supplyId, reason: reading.reason,
      currentReason: current !== null ? null : isRail && hasIcSupply ? 'IC supply current is not modeled; inspect the output load wire.' : reading.reason ?? (loads.uncertainNets.has(net) ? 'Output load current unavailable' : 'Current unavailable · redundant conductive loop'),
      estimatedUnsafe: loads.unsafeNets.has(net) || (previous?.estimatedUnsafe ?? false),
    };
  }
  return { power, digital };
}
