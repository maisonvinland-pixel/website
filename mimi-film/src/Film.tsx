import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill } from "remotion";
import { Engine } from "./three/Engine";
import { Subtitles, TypeLayer } from "./type/TypeLayer";
import { H, W } from "./world";

export const Layer3D: React.FC = () => (
  <AbsoluteFill style={{ background: "#FDF0F4" }}>
    <ThreeCanvas width={W} height={H} gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}>
      <Engine />
    </ThreeCanvas>
  </AbsoluteFill>
);

/** Aperçu complet (studio) : 3D + typo (+ sous-titres). Le rendu final assemble les couches séparément. */
export const Film: React.FC<{ subtitles: boolean; typeSamples?: number }> = ({ subtitles, typeSamples = 8 }) => (
  <AbsoluteFill>
    <Layer3D />
    <TypeLayer samples={typeSamples} />
    {subtitles && <Subtitles />}
  </AbsoluteFill>
);

export const TypeOnly: React.FC = () => <TypeLayer samples={8} />;
export const SubsOnly: React.FC = () => <Subtitles />;
