import { useFrame, useThree } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  Pass,
} from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import { getInputProps, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { C, FPS } from "../timing";
import { DROPS, bubbleAt, cameraAt, dropAt, flashAt, motionPx, rng, sameShot, setupCamera } from "../world";
import { makeGumDepthMaterial, makeGumMaterial } from "./bubbleMaterial";

const DBG = (getInputProps() as any).dbg ?? {};
const SAMPLES = Number(DBG.samples ?? 8);
const SHUTTER = 0.5; // obturateur à 180° : la moitié de la durée d'une image

// ---------- passe d'accumulation : N rendus décalés dans le temps, moyennés ----------
class AccumPass extends Pass {
  rt: THREE.WebGLRenderTarget;
  quad: THREE.Mesh;
  quadScene: THREE.Scene;
  quadCam: THREE.OrthographicCamera;
  constructor(
    private world3: THREE.Scene,
    private cam3: THREE.PerspectiveCamera,
    private pose: (t: number, jitter: [number, number]) => void,
    public time = 0,
    public samples = 8
  ) {
    super("AccumPass");
    this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.rt.texture }, w: { value: 1 } },
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: "uniform sampler2D map;uniform float w;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vUv)*w;}",
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w: number, h: number) {
    this.rt.setSize(w, h);
  }
  render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget) {
    const mat = this.quad.material as THREE.ShaderMaterial;
    renderer.setRenderTarget(inputBuffer);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    // ordre : l'échantillon le plus proche du centre en dernier (sa profondeur sert au flou de mise au point)
    const n = this.samples;
    mat.uniforms.w.value = 1 / n;
    const offs: number[] = [];
    for (let i = 0; i < n; i++) offs.push(((i + 0.5) / n - 0.5) * SHUTTER);
    offs.sort((a, b) => Math.abs(b) - Math.abs(a));
    const jr = rng(Math.floor(this.time * 1000));
    // une seule carte d'ombre par image : l'ombre est diffuse, son flou de mouvement est imperceptible
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    for (const o of offs) {
      // jitter sous-pixel : anticrénelage temporel gratuit
      this.pose(sameShot(this.time, this.time + o / FPS), [jr() - 0.5, jr() - 0.5]);
      renderer.setRenderTarget(this.rt);
      renderer.clear(true, true, true);
      renderer.render(this.world3, this.cam3);
      renderer.setRenderTarget(inputBuffer);
      renderer.render(this.quadScene, this.quadCam);
    }
  }
}

// ---------- étalonnage : épaule douce sur les hautes lumières, couleurs de marque intactes ----------
class GradeEffect extends Effect {
  constructor() {
    super(
      "GradeEffect",
      /* glsl */ `
      uniform float exposure;
      uniform float flash;
      vec3 shoulder(vec3 c){
        const float s=0.97;
        vec3 x=max(c-s,0.0);
        vec3 y=s+(1.0-s)*(1.0-exp(-x/(1.0-s)));
        return mix(c,y,step(vec3(s),c));
      }
      void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){
        vec3 c=inputColor.rgb*exposure;
        float l=max(max(c.r,c.g),c.b);
        c+=vec3(1.0,0.86,0.92)*flash*0.55;
        vec3 o=shoulder(c);
        o=mix(o,vec3(1.0),clamp((l-1.0)/4.0,0.0,1.0)*0.55);
        // très léger réchauffement des ombres vers le rose framboise
        float lum=dot(o,vec3(0.2126,0.7152,0.0722));
        o+=vec3(0.018,-0.004,0.006)*(1.0-smoothstep(0.0,0.6,lum));
        outputColor=vec4(clamp(o,0.0,1.0),inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map<string, THREE.Uniform>([
          ["exposure", new THREE.Uniform(1)],
          ["flash", new THREE.Uniform(0)],
        ]),
      }
    );
  }
}

// ---------- décor ----------
function makeBackdrop() {
  const c = (h: string) => new THREE.Color(h);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: c("#FDF0F4") },
      bottom: { value: c("#F9E1EA") },
      glow: { value: c("#F3A2BE") },
      glowDir: { value: new THREE.Vector3(0, 0, -1) },
    },
    vertexShader: "varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: /* glsl */ `
      uniform vec3 top,bottom,glow,glowDir;varying vec3 vDir;
      void main(){
        vec3 d=normalize(vDir);
        vec3 col=mix(bottom,top,smoothstep(-0.5,0.05,d.y));
        float g=pow(max(dot(d,normalize(glowDir)),0.0),24.0);
        col=mix(col,glow,g*0.16);
        gl_FragColor=vec4(col,1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(80, 64, 32), mat);
  m.renderOrder = -10;
  return { mesh: m, mat };
}

function makeContactShadowTexture() {
  const s = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const g = cv.getContext("2d")!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(120,30,70,0.55)");
  grd.addColorStop(0.35, "rgba(120,30,70,0.28)");
  grd.addColorStop(1, "rgba(120,30,70,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// petites billes de gomme qui flottent dans le studio (profondeur, parallaxe, bokeh)
const FLOATERS = (() => {
  const r = rng(21);
  const cols = ["#F3A2BE", "#EC88AC", "#FCD3E1", "#F3A2BE", "#FCD3E1", "#FCD3E1", "#EC88AC", "#F3A2BE", "#FCD3E1"];
  const pts: [number, number, number][] = [
    [-3.2, 2.6, -4],
    [3.6, -0.6, -6],
    [-4.2, -1.2, 2.4],
    [2.4, 2.9, 2.2],
    [5.2, 1.6, -2.5],
    [-5.0, 0.4, -1.5],
    [0.6, 3.6, -7],
    [-1.4, 1.9, 6.6], // premier plan du titre (bascule de point)
    [3.1, -1.1, 4.4],
  ];
  return pts.map((p, i) => ({ p: new THREE.Vector3(...p), r: 0.12 + r() * 0.2 + (i === 7 ? 0.22 : 0), color: cols[i], ph: r() * 6 }));
})();

export const Engine: React.FC = () => {
  const { gl, size } = useThree();
  const frame = useCurrentFrame();
  const timeRef = useRef(0);
  timeRef.current = frame / FPS;

  const world = useMemo(() => {
    gl.shadowMap.enabled = !DBG.noShadow;
    gl.shadowMap.type = THREE.VSMShadowMap;
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, size.width / size.height, 0.05, 200);
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.6;

    const backdrop = makeBackdrop();
    if (!DBG.noBg) scene.add(backdrop.mesh);

    // lumières de studio : clé douce en haut à gauche, contre-jour rose, débouchage
    const key = new THREE.DirectionalLight("#FFF6F8", 1.7);
    key.position.set(-3, 10, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.radius = 14;
    key.shadow.blurSamples = 16;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#FFD3E2", 1.6);
    rim.position.set(6, 3, -7);
    scene.add(rim);
    const fill = new THREE.HemisphereLight("#FFF4F7", "#E8A9C0", 0.25);
    scene.add(fill);

    // sol « attrape-ombres » : invisible, seules les ombres apparaissent
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ color: new THREE.Color("#8E2F57"), opacity: 0.16 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.42;
    ground.receiveShadow = true;
    scene.add(ground);
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: makeContactShadowTexture(), transparent: true, depthWrite: false, toneMapped: false })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = -1.415;
    scene.add(contact);

    // la bulle
    const gum = makeGumMaterial({ color: "#EE8DB0", seed: 1.3, iridescence: DBG.noIri ? 0 : undefined });
    if (DBG.basic) gum.mat.clearcoat = 0, gum.mat.sheen = 0;
    const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1, DBG.detail ?? 96), gum.mat);
    bubble.castShadow = true;
    bubble.customDepthMaterial = makeGumDepthMaterial(gum.uniforms);
    scene.add(bubble);

    // gouttes de l'éclatement
    const dropGeo = new THREE.IcosahedronGeometry(1, 6);
    const dropMats = ["#F3A2BE", "#EC88AC", "#FCD3E1"].map(
      (c) =>
        new THREE.MeshPhysicalMaterial({
          color: c,
          roughness: 0.28,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          sheen: 1,
          sheenColor: new THREE.Color("#FFD9E6"),
        })
    );
    const drops = DROPS.map((d) => {
      const m = new THREE.Mesh(dropGeo, dropMats[d.color]);
      m.castShadow = true;
      m.visible = false;
      scene.add(m);
      return m;
    });

    // onde de choc du drop
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 128),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 2.6), transparent: true, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.visible = false;
    scene.add(ring);

    // billes flottantes
    const floaterGeo = new THREE.IcosahedronGeometry(1, 12);
    const floaters = FLOATERS.map((f) => {
      const m = new THREE.Mesh(
        floaterGeo,
        new THREE.MeshPhysicalMaterial({ color: f.color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.8, sheenColor: new THREE.Color("#FFE3EC") })
      );
      m.scale.setScalar(f.r);
      scene.add(m);
      return m;
    });

    const pose = (t: number, jitter: [number, number]) => {
      const c = cameraAt(t);
      setupCamera(camera, c);
      // jitter sous-pixel (en pixels de rendu)
      camera.setViewOffset(size.width, size.height, jitter[0] * 0.9, jitter[1] * 0.9, size.width, size.height);
      camera.updateProjectionMatrix();
      backdrop.mat.uniforms.glowDir.value.copy(camera.position).negate().normalize();

      const b = bubbleAt(t);
      bubble.visible = b.visible;
      bubble.position.copy(b.pos);
      bubble.rotation.set(0.12 * Math.sin(t * 0.5), b.yaw, 0.06 * Math.sin(t * 0.37));
      bubble.scale.setScalar(b.scale);
      gum.uniforms.uTime.value = t;
      gum.uniforms.uWob.value = b.wob;
      gum.uniforms.uSquash.value.copy(b.squash);
      // la pointe est exprimée en espace monde : on la ramène dans le repère de la bulle
      gum.uniforms.uTip.value.copy(b.tip).applyEuler(new THREE.Euler(0, -b.yaw, 0));

      const h = b.pos.y - ground.position.y;
      const cs = b.visible ? b.scale * (2.2 + h * 0.3) : 0;
      contact.visible = cs > 0.01;
      contact.position.x = b.pos.x;
      contact.position.z = b.pos.z;
      contact.scale.set(cs * 1.15, cs, 1);
      (contact.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(1.25 - h * 0.25, 0, 1);

      drops.forEach((m, i) => {
        const d = dropAt(i, t);
        m.visible = !!d && d.size > 0.002;
        if (d) {
          m.position.copy(d.p);
          m.scale.setScalar(d.size);
          m.rotation.set(d.rot.x, d.rot.y, d.rot.z);
        }
      });

      const fl = t - C.drop;
      ring.visible = fl >= 0 && fl < 0.5;
      if (ring.visible) {
        const u = fl / 0.5;
        ring.scale.setScalar(1.8 + 6.5 * (1 - Math.pow(1 - u, 3)));
        ring.lookAt(camera.position);
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - u, 2) * 0.9;
      }

      floaters.forEach((m, i) => {
        const f = FLOATERS[i];
        m.position.set(
          f.p.x + 0.25 * Math.sin(t * 0.35 + f.ph),
          f.p.y + 0.3 * Math.sin(t * 0.5 + f.ph * 1.3),
          f.p.z + 0.2 * Math.cos(t * 0.3 + f.ph)
        );
      });
    };

    const composer = new EffectComposer(gl, { frameBufferType: THREE.FloatType });
    const accum = new AccumPass(scene, camera, pose);
    composer.addPass(accum);
    const dof = new DepthOfFieldEffect(camera, { focusDistance: 10, focusRange: 2.5, bokehScale: 2, resolutionScale: 0.25 });
    const bloom = new BloomEffect({ luminanceThreshold: 1.0, luminanceSmoothing: 0.35, intensity: 0.55, mipmapBlur: true, radius: 0.7 });
    const ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0009, 0.0006), radialModulation: true, modulationOffset: 0.25 });
    const grade = new GradeEffect();
    if (!DBG.noDof) {
      const dofPass = new EffectPass(camera, dof);
      dofPass.setDepthTexture(accum.rt.depthTexture!);
      composer.addPass(dofPass);
    }
    composer.addPass(new EffectPass(camera, ca, bloom, grade));
    composer.setSize(size.width, size.height, false);
    accum.setSize(gl.domElement.width, gl.domElement.height);

    return { composer, accum, dof, bloom, grade, camera };
  }, [gl, size.width, size.height]);

  useEffect(() => () => world.composer.dispose(), [world]);

  useFrame(() => {
    const t = timeRef.current;
    const c = cameraAt(t);
    world.accum.time = t;
    // nombre de sous-images selon le mouvement : pas de saut visible de plus de ~1,6 px (échelle 1)
    const m = motionPx(t, SHUTTER / FPS);
    world.accum.samples = DBG.samples ? SAMPLES : Math.round(THREE.MathUtils.clamp(Math.ceil(m / 1.8), 2, 24));
    world.dof.cocMaterial.focusDistance = c.focus;
    world.dof.cocMaterial.focusRange = Math.max(1.0, c.focus * 0.16);
    world.dof.bokehScale = c.bokeh * 2.6 * gl.getPixelRatio();
    const f = flashAt(t);
    world.grade.uniforms.get("flash")!.value = f;
    world.bloom.intensity = 0.55 + f * 2.5;
    world.composer.render();
  }, 1);

  void size;
  return null;
};
