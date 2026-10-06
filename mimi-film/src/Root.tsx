import { Composition } from "remotion";
import { Film, Layer3D, SubsOnly, TypeOnly } from "./Film";
import { FPS, FRAMES } from "./timing";
import { H, W } from "./world";

const common = { durationInFrames: FRAMES, fps: FPS, width: W, height: H };

export const Root: React.FC = () => (
  <>
    <Composition id="MIMI" component={Film} {...common} defaultProps={{ subtitles: false, typeSamples: 8 }} />
    <Composition id="MIMI-ST" component={Film} {...common} defaultProps={{ subtitles: true, typeSamples: 8 }} />
    <Composition id="MIMI-3D" component={Layer3D} {...common} />
    <Composition id="MIMI-TYPE" component={TypeOnly} {...common} />
    <Composition id="MIMI-SUBS" component={SubsOnly} {...common} />
  </>
);
