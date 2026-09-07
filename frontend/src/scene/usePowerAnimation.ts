import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { transitionValue } from '../lib/powerVisuals';
import type { PowerVisuals } from '../lib/powerVisuals';

const query = '(prefers-reduced-motion: reduce)';
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const reducedMotion = () => window.matchMedia(query).matches;

export function usePowerAnimation(visuals: PowerVisuals | null, switchOn: boolean, lightOn: number, duration = 180) {
  const { invalidate } = useThree();
  const reduced = useSyncExternalStore(subscribe, reducedMotion, () => false);
  // Recreated render nodes (for example after a mount drag) start at their
  // retained state; only subsequent electrical changes need a transition.
  const current = useRef({ rocker: Number(switchOn), light: Number(lightOn) });
  const transition = useRef({ started: 0, rocker: 0, light: 0, active: false });
  useEffect(() => {
    if (!visuals) return;
    if (reduced) {
      current.current = { rocker: Number(switchOn), light: Number(lightOn) };
      transition.current.active = false;
      visuals.apply(current.current.rocker, current.current.light);
    } else {
      transition.current = {
        started: performance.now(), ...current.current,
        active: current.current.rocker !== Number(switchOn) || current.current.light !== Number(lightOn),
      };
      visuals.apply(current.current.rocker, current.current.light);
    }
    invalidate();
  }, [visuals, switchOn, lightOn, reduced, invalidate, duration]);
  useFrame(() => {
    if (!visuals || !transition.current.active) return;
    const elapsed = performance.now() - transition.current.started;
    current.current = {
      rocker: transitionValue(transition.current.rocker, Number(switchOn), elapsed, duration),
      light: transitionValue(transition.current.light, Number(lightOn), elapsed, 150),
    };
    visuals.apply(current.current.rocker, current.current.light);
    transition.current.active = elapsed < Math.max(duration, 150);
    if (transition.current.active) invalidate();
  });
  useEffect(() => () => visuals?.dispose(), [visuals]);
}
