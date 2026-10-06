import * as THREE from "three";

// Bruit simplex 3D (Ashima Arts / Stefan Gustavson, licence MIT).
const SNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/**
 * Déformation de la gomme, en espace objet (sphère unité) :
 *  - bruit organique « gélatine » (uWob)
 *  - étirement vers une pointe (uTip) avec un col qui s'amincit, comme un chewing-gum qu'on tire
 *  - écrasement / étirement anisotrope (uSquash) piloté par la physique de ressort
 */
const DISPLACE = /* glsl */ `
uniform float uTime;
uniform float uWob;
uniform vec3 uTip;
uniform vec3 uSquash;
uniform float uSeed;
${SNOISE}
vec3 gumDisplace(vec3 p){
  vec3 n=normalize(p);
  float t=uTime;
  float nz=snoise(n*1.2+vec3(uSeed,t*0.32,-t*0.21))*0.74
          +snoise(n*2.4+vec3(-t*0.55,uSeed*1.7,t*0.4))*0.21
          +snoise(n*5.0+vec3(t*0.9,-t*0.7,uSeed))*0.05;
  vec3 q=n*(1.0+uWob*0.034*nz+0.004*nz);
  float L=length(uTip);
  if(L>1e-4){
    vec3 d=uTip/L;
    float f=max(dot(n,d),0.0);
    float w=pow(f,4.0);
    // la calotte face à la pointe suit la pointe
    q+=d*L*w;
    // le col s'amincit : on ramène la composante latérale vers l'axe
    vec3 lat=q-d*dot(q,d);
    float neck=smoothstep(0.15,0.85,f)*(1.0-w);
    q-=lat*neck*clamp(L*0.42,0.0,0.62);
  }
  q*=uSquash;
  return q;
}`;

export type GumUniforms = {
  uTime: { value: number };
  uWob: { value: number };
  uTip: { value: THREE.Vector3 };
  uSquash: { value: THREE.Vector3 };
  uSeed: { value: number };
  uRim: { value: number };
};

export function makeGumMaterial(opts: { color: string; seed?: number; iridescence?: number }) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.color),
    roughness: 0.34,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    sheen: 0.35,
    sheenColor: new THREE.Color("#FFD0E0"),
    sheenRoughness: 0.5,
    iridescence: opts.iridescence ?? 0.16,
    iridescenceIOR: 1.32,
    iridescenceThicknessRange: [180, 420],
    specularIntensity: 0.9,
    envMapIntensity: 1.0,
  });
  const uniforms: GumUniforms = {
    uTime: { value: 0 },
    uWob: { value: 0.4 },
    uTip: { value: new THREE.Vector3() },
    uSquash: { value: new THREE.Vector3(1, 1, 1) },
    uSeed: { value: opts.seed ?? 0 },
    uRim: { value: 1 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${DISPLACE}`)
      .replace(
        "#include <beginnormal_vertex>",
        /* glsl */ `
        vec3 gp=gumDisplace(position);
        vec3 gn0=normalize(position);
        vec3 gt=normalize(abs(gn0.y)<0.99?cross(gn0,vec3(0.0,1.0,0.0)):cross(gn0,vec3(1.0,0.0,0.0)));
        vec3 gb=cross(gn0,gt);
        float ge=0.004;
        vec3 ga=gumDisplace(normalize(gn0+gt*ge));
        vec3 gc=gumDisplace(normalize(gn0+gb*ge));
        vec3 objectNormal=normalize(cross(ga-gp,gc-gp));
        if(dot(objectNormal,gp)<0.0) objectNormal=-objectNormal;
        #ifdef USE_TANGENT
          vec3 objectTangent=vec3(tangent.xyz);
        #endif`
      )
      .replace("#include <begin_vertex>", "vec3 transformed=gp;");
    // translucidité légère : la lumière arrière traverse la gomme sur les bords
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uRim;")
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `
        {
          vec3 V=normalize(vViewPosition);
          float fr=pow(1.0-clamp(dot(normal,V),0.0,1.0),2.6);
          vec3 sss=vec3(1.0,0.3,0.5)*fr*0.3*uRim;
          // diffusion interne : un coeur plus chaud et plus lumineux
          float core=pow(clamp(dot(normal,V),0.0,1.0),1.6);
          outgoingLight+=sss+diffuseColor.rgb*core*0.035*uRim;
        }
        #include <opaque_fragment>`
      );
  };
  mat.customProgramCacheKey = () => "gum-v3";
  return { mat, uniforms };
}

/** Matériau d'ombre portée qui suit exactement la même déformation que la gomme. */
export function makeGumDepthMaterial(uniforms: GumUniforms) {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${DISPLACE}`)
      .replace("#include <begin_vertex>", "vec3 transformed=gumDisplace(position);");
  };
  mat.customProgramCacheKey = () => "gum-depth-v3";
  return mat;
}
