/**
 * Remix dual-dissolve material.
 *
 * Every remixable object is rendered twice from the same geometry:
 *   grey side  — Lux3D material-transfer GLB (or the neon GLB desaturated in-shader)
 *   neon side  — Lux3D text-to-3D GLB, bright texels become emissive
 * Both sides share one uniform set. A sphere of radius uRadius around uOrigin
 * (plus world-space noise) decides which side draws; a glowing edge rides the border.
 */
import * as THREE from 'three';

export interface RemixUniforms {
  uOrigin: { value: THREE.Vector3 };
  uRadius: { value: number };
  uEdgeColor: { value: THREE.Color };
  uTime: { value: number };
  uGlow: { value: number };
}

export const newRemixUniforms = (): RemixUniforms => ({
  uOrigin: { value: new THREE.Vector3() },
  uRadius: { value: -1 },
  uEdgeColor: { value: new THREE.Color('#3EE6FF') },
  uTime: { value: 0 },
  uGlow: { value: 1 },
});

/** Global time shared by all remix materials (flicker). */
export const remixTime = { value: 0 };

const NOISE = /* glsl */ `
varying vec3 vRemixPos;
uniform vec3 uOrigin; uniform float uRadius; uniform vec3 uEdgeColor; uniform float uGlow; uniform float uTime;
float rmxHash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float rmxNoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(rmxHash(i),rmxHash(i+vec3(1,0,0)),f.x),mix(rmxHash(i+vec3(0,1,0)),rmxHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(rmxHash(i+vec3(0,0,1)),rmxHash(i+vec3(1,0,1)),f.x),mix(rmxHash(i+vec3(0,1,1)),rmxHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
`;

/**
 * Patch a material for one side of the remix.
 * side 0 = grey, 1 = neon. desat=true turns the neon texture grey (fallback when no grey GLB exists).
 */
export function makeRemixMaterial(src: THREE.Material, u: RemixUniforms, side: 0 | 1, desat: boolean): THREE.Material {
  const m = (src as THREE.MeshStandardMaterial).clone();
  if (side === 1 && 'emissive' in m) { m.emissive = new THREE.Color(0x000000); }
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, { uTime: remixTime });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRemixPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRemixPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <clipping_planes_fragment>', /* glsl */ `#include <clipping_planes_fragment>
        float rmxD = distance(vRemixPos, uOrigin) + rmxNoise(vRemixPos * 0.9) * 1.6;
        float rmxRev = step(rmxD, uRadius);
        ${side === 0 ? 'if (rmxRev > 0.5) discard;' : 'if (rmxRev < 0.5) discard;'}`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        ${side === 0 && desat ? `{ float l = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114));
           diffuseColor.rgb = mix(vec3(l), vec3(l) * vec3(0.86, 0.9, 1.0), 0.6) * 0.82; }` : ''}`)
      .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
        ${side === 1 ? `{
          vec3 c = diffuseColor.rgb;
          float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
          float sat = mx > 0.0 ? (mx - mn) / mx : 0.0;
          float glow = smoothstep(0.55, 0.9, mx) * (0.35 + sat);
          float flick = 0.85 + 0.15 * sin(uTime * 6.0 + vRemixPos.x * 1.7 + vRemixPos.z);
          totalEmissiveRadiance += c * glow * 2.2 * uGlow * flick;
          float edge = 1.0 - smoothstep(0.0, 1.4, uRadius - rmxD);
          totalEmissiveRadiance += uEdgeColor * edge * 5.0;
        }` : ''}`);
  };
  m.customProgramCacheKey = () => `remix${side}${desat ? 1 : 0}`;
  return m;
}

/** Apply remix materials to every mesh under root. */
export function applyRemix(root: THREE.Object3D, u: RemixUniforms, side: 0 | 1, desat: boolean) {
  const cache = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const conv = (mat: THREE.Material) => {
      let c = cache.get(mat);
      if (!c) { c = makeRemixMaterial(mat, u, side, desat); cache.set(mat, c); }
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
    mesh.castShadow = true; mesh.receiveShadow = true;
  });
}
