import { useEffect, useMemo } from 'react';
import { BackSide, TubeGeometry } from 'three';
import type { Point3 } from '../../types/workspace';
import { roundedWireCurve } from '../../lib/wireGeometry';

export function Wire({ points, color, selected, preview, id }: { points: Point3[]; color: string; selected?: boolean; preview?: boolean; id?: string }) {
  // The serialized route keeps geometry stable when unrelated components or UI change.
  const route = JSON.stringify(points);
  const geometry = useMemo(() => {
    const points = JSON.parse(route) as Point3[];
    return new TubeGeometry(roundedWireCurve(points), Math.max(32, points.length * 16), 0.0005, 8, false);
  }, [route]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const outline = useMemo(() => selected ? new TubeGeometry(roundedWireCurve(JSON.parse(route) as Point3[]), Math.max(32, (JSON.parse(route) as Point3[]).length * 16), 0.0008, 8, false) : null, [route, selected]);
  useEffect(() => () => outline?.dispose(), [outline]);
  return <group><mesh userData={{ wireId: id }} raycast={preview ? () => null : undefined}>
    <primitive object={geometry} attach="geometry" dispose={null} />
    <meshStandardMaterial color={color} roughness={0.45} transparent={preview} opacity={preview ? 0.6 : 1} emissive={selected ? '#134184' : '#000000'} emissiveIntensity={selected ? 0.3 : 0} />
  </mesh>{outline && <mesh raycast={() => null}><primitive object={outline} attach="geometry" dispose={null} /><meshBasicMaterial color="#2680ef" side={BackSide} transparent opacity={0.8} depthWrite={false} /></mesh>}</group>;
}
