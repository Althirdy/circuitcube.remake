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

export function usePowerAnimation(visuals: PowerVisuals | null, switchOn: boolean, lightOn: boolean) {
  const { invalidate } = useThree();
  const reduced = useSyncExternalStore(subscribe, reducedMotion, () => false);
  const current = useRef({ rocker: 0, light: 0 });
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
  }, [visuals, switchOn, lightOn, reduced, invalidate]);
  useFrame(() => {
    if (!visuals || !transition.current.active) return;
    const elapsed = performance.now() - transition.current.started;
    current.current = {
      rocker: transitionValue(transition.current.rocker, Number(switchOn), elapsed, 180),
      light: transitionValue(transition.current.light, Number(lightOn), elapsed, 150),
    };
    visuals.apply(current.current.rocker, current.current.light);
    transition.current.active = elapsed < 180;
    if (transition.current.active) invalidate();
  });
  useEffect(() => () => visuals?.dispose(), [visuals]);
}
