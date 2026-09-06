import type { ComponentInstance, SocketSource, TerminalDefinition, TerminalRef } from '../types/workspace';
import { socketsFor } from './breadboard';

export const POWER_TERMINALS = [
  { id: 'positive', mesh: 'Positive_Terminal_Metal', base: 'Positive_Terminal_Base', anchor: 'Positive_Wire_Anchor' },
  { id: 'negative', mesh: 'Negative_Terminal_Metal', base: 'Negative_Terminal_Base', anchor: 'Negative_Wire_Anchor' },
] as const;

export function terminalDefinition(component: ComponentInstance | undefined, id: string, sockets: SocketSource, powerTerminals: TerminalDefinition[] = []) {
  const definitions = component?.modelId === 'power' ? powerTerminals : socketsFor(component, sockets);
  return definitions.find(terminal => terminal.id === id);
}

export function routingSurface(from: TerminalRef, instances: ComponentInstance[], sockets: SocketSource): number {
  return socketsFor(instances.find(instance => instance.id === from.componentId), sockets).find(socket => socket.id === from.terminalId)?.position[1] ?? 0;
}

export const terminalLabel = (id: string) => id === 'positive' ? 'Supply +' : id === 'negative' ? 'Supply −' : id;
