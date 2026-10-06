import React from "react";
import { clamp, easeIn, easeInOut, easeOut, easeOutExpo, inv, lerp, springOut } from "../world";
import { BODY, COLORS, DISPLAY, MONO } from "./fonts";

export type Seg = { text: string; em?: boolean };
export type LineDef = Seg[];

type Style = "rise" | "stretch" | "roll";

/**
 * Bloc de texte cinétique en Fraunces variable.
 * Chaque lettre sort d'un masque, se gonfle (wght, SOFT) puis « wonke » (WONK) en se posant.
 */
export const Kinetic: React.FC<{
  t: number;
  tin: number;
  tout: number;
  lines: LineDef[];
  x: number;
  y: number;
  size: number;
  lineHeight?: number;
  stagger?: number;
  style?: Style;
  color?: string;
  emColor?: string;
  weight?: number;
  align?: "left" | "center";
  width?: number;
  exit?: "up" | "fade" | "drift" | "none";
  forget?: { word: string; at: number }; // mot qui « s'oublie » (dérive, flou, s'efface)
  shake?: (t: number) => number;
}> = ({
  t,
  tin,
  tout,
  lines,
  x,
  y,
  size,
  lineHeight = 0.98,
  stagger = 0.028,
  style = "rise",
  color = COLORS.ink,
  emColor = COLORS.rasp,
  weight = 800,
  align = "left",
  width = 940,
  exit = "up",
  forget,
  shake,
}) => {
  if (t < tin - 0.05 || t > tout + 1.2) return null;
  let idx = 0;
  const lh = size * lineHeight;
  return (
    <div style={{ position: "absolute", left: x, top: y, width, textAlign: align }}>
      {lines.map((line, li) => (
        <div
          key={li}
          style={{
            height: lh,
            // masque par ligne : marge basse pour les jambages, marge haute pour les accents
            overflow: "hidden",
            padding: `${size * 0.16}px ${size * 0.08}px ${size * 0.22}px`,
            margin: `${-size * 0.16}px ${-size * 0.08}px ${-size * 0.22}px`,
            boxSizing: "content-box",
            whiteSpace: "nowrap",
          }}
        >
          {line.map((seg, si) => {
            const chars = [...seg.text];
            return (
              <span key={si} style={{ display: "inline-block", whiteSpace: "pre" }}>
                {chars.map((ch, ci) => {
                  const i = idx++;
                  const local = t - tin - i * stagger;
                  const p = clamp(local / 0.85);
                  const pa = clamp((local - 0.05) / 1.05);
                  const isForget = forget && seg.text.includes(forget.word);
                  let ty = 0;
                  let rot = 0;
                  let sy = 1;
                  let op = 1;
                  let blur = 0;
                  let dx = 0;
                  if (style === "stretch") {
                    // la lettre est étirée comme de la gomme puis revient en place
                    ty = (1 - easeOutExpo(p)) * 115;
                    sy = lerp(1.9, 1, springOut(clamp(local / 0.9), 9, 0.28));
                  } else {
                    ty = (1 - easeOutExpo(p)) * 112;
                    rot = (1 - easeOutExpo(p)) * 7;
                    sy = lerp(1.18, 1, springOut(clamp(local / 0.8), 8, 0.35));
                  }
                  // sortie
                  const lo = t - tout - i * stagger * 0.55;
                  if (lo > 0) {
                    const q = clamp(lo / 0.38);
                    if (exit === "up") ty -= easeIn(q) * 160;
                    if (exit === "fade") op *= 1 - easeOut(q);
                    if (exit === "drift") {
                      op *= 1 - easeOut(q);
                      ty -= easeOut(q) * 40;
                      blur += q * 10;
                    }
                  }
                  if (isForget && forget) {
                    const fq = clamp((t - forget.at - ci * 0.045) / 0.9);
                    op *= 1 - easeInOut(fq) * 0.92;
                    blur += easeIn(fq) * 16;
                    ty -= easeOut(fq) * 26;
                    dx += easeOut(fq) * 18 * Math.sin(ci * 2.1);
                  }
                  if (shake) {
                    const a = shake(t);
                    dx += Math.sin(t * 61 + i * 1.7) * a;
                    ty += (Math.cos(t * 53 + i * 2.3) * a * 100) / size;
                  }
                  const wght = seg.em ? lerp(380, weight - 100, easeOut(pa)) : lerp(380, weight, easeOut(pa));
                  const soft = lerp(0, 100, easeOut(pa));
                  const wonk = pa > 0.55 ? 1 : 0;
                  return (
                    <span
                      key={ci}
                      style={{
                        display: "inline-block",
                        fontFamily: DISPLAY,
                        fontSize: size,
                        fontStyle: seg.em ? "italic" : "normal",
                        color: seg.em ? emColor : color,
                        fontVariationSettings: `"wght" ${wght.toFixed(1)}, "SOFT" ${soft.toFixed(1)}, "WONK" ${wonk}, "opsz" 144`,
                        letterSpacing: "-0.035em",
                        lineHeight: 1,
                        transform: `translate(${dx.toFixed(2)}px, ${ty.toFixed(2)}%) rotate(${rot.toFixed(2)}deg) scaleY(${sy.toFixed(4)})`,
                        transformOrigin: "50% 100%",
                        opacity: op,
                        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Mot qui roule dans une fente (« remarque » → « retienne » → « achète ») */
export const RollWord: React.FC<{
  t: number;
  words: { text: string; at: number }[];
  tout: number;
  x: number;
  y: number;
  size: number;
}> = ({ t, words, tout, x, y, size }) => {
  if (t < words[0].at - 0.05 || t > tout + 0.8) return null;
  return (
    <div style={{ position: "absolute", left: x - size * 0.08, top: y - size * 0.16, height: size * 1.36, overflow: "hidden", padding: `0 ${size * 0.08}px`, width: 1000 }}>
      {words.map((w, wi) => {
        const next = words[wi + 1]?.at ?? tout;
        if (t < w.at - 0.05 || t > next + 0.6) return null;
        return (
          <div key={wi} style={{ position: "absolute", left: size * 0.08, top: size * 0.16, whiteSpace: "nowrap" }}>
            {[...w.text].map((ch, ci) => {
              const pin = clamp((t - w.at - ci * 0.022) / 0.6);
              const pout = clamp((t - next - ci * 0.018) / 0.32);
              const ty = (1 - easeOutExpo(pin)) * 130 - easeIn(pout) * 160;
              const pa = clamp((t - w.at - ci * 0.022) / 0.9);
              return (
                <span
                  key={ci}
                  style={{
                    display: "inline-block",
                    fontFamily: DISPLAY,
                    fontStyle: "italic",
                    fontSize: size,
                    lineHeight: 1,
                    color: COLORS.rasp,
                    letterSpacing: "-0.03em",
                    fontVariationSettings: `"wght" ${lerp(350, 760, easeOut(pa)).toFixed(1)}, "SOFT" ${lerp(0, 100, pa).toFixed(1)}, "WONK" ${pa > 0.5 ? 1 : 0}, "opsz" 144`,
                    transform: `translateY(${ty.toFixed(2)}%) scaleY(${lerp(1.25, 1, springOut(pin, 8, 0.33)).toFixed(4)})`,
                    transformOrigin: "50% 100%",
                    whiteSpace: "pre",
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

/** Étiquette JetBrains Mono, comme les « eyebrows » du site, tapée lettre par lettre */
export const Eyebrow: React.FC<{ t: number; tin: number; tout: number; text: string; x: number; y: number; size?: number; center?: boolean }> = ({
  t,
  tin,
  tout,
  text,
  x,
  y,
  size = 34,
  center,
}) => {
  if (t < tin || t > tout + 0.5) return null;
  const n = Math.floor(clamp((t - tin) / (text.length * 0.035)) * text.length);
  const out = clamp((t - tout) / 0.3);
  const dot = springOut(clamp((t - tin) / 0.6), 9, 0.3);
  const cursorOn = n < text.length || Math.floor((t - tin) * 3.2) % 2 === 0;
  return (
    <div
      style={{
        position: "absolute",
        left: center ? 0 : x,
        width: center ? 1080 : undefined,
        top: y,
        display: "flex",
        justifyContent: center ? "center" : "flex-start",
        alignItems: "center",
        gap: size * 0.55,
        opacity: 1 - out,
        transform: `translateY(${-out * 20}px)`,
      }}
    >
      <span
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: "50%",
          background: COLORS.bubble2,
          boxShadow: `0 0 0 ${size * 0.22}px ${COLORS.paper}`,
          transform: `scale(${dot})`,
          flex: "none",
        }}
      />
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: size, letterSpacing: "0.14em", color: COLORS.ink2, textTransform: "uppercase", whiteSpace: "pre" }}>
        {text.slice(0, n)}
        <span style={{ opacity: cursorOn && out === 0 ? 1 : 0, color: COLORS.bubble2 }}>▍</span>
      </span>
    </div>
  );
};

const ICONS: Record<string, React.ReactNode> = {
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  insta: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" />
    </>
  ),
  site: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  ia: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
};

/** Pastille de service, comme sur le site (pilule blanche, icône bleu ciel) */
export const ChipPill: React.FC<{ label: string; icon: string; scale?: number; collapse?: number }> = ({ label, icon, scale = 1, collapse = 0 }) => {
  const c = collapse;
  const s = 2.15 * scale;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12 * s * (1 - c),
        background: c > 0.6 ? COLORS.bubble : "rgba(255,255,255,0.96)",
        border: `${1.5 * s}px solid ${c > 0.6 ? "#FFFFFF" : COLORS.line}`,
        borderRadius: 999,
        padding: `${9 * s * (1 - c) + 2}px ${15 * s * (1 - c) + 2}px ${9 * s * (1 - c) + 2}px ${10 * s * (1 - c) + 2}px`,
        boxShadow: `0 ${16 * s}px ${34 * s}px -${18 * s}px rgba(107,30,64,0.55)`,
        whiteSpace: "nowrap",
        transform: "translate(-50%, -50%)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          width: lerp(28 * s, 16 * s, c),
          height: lerp(28 * s, 16 * s, c),
          borderRadius: "50%",
          background: c > 0.6 ? "radial-gradient(circle at 35% 30%, #fff 0 18%, #F3A2BE 46%, #EC88AC 100%)" : COLORS.floss,
          display: "grid",
          placeItems: "center",
          flex: "none",
        }}
      >
        <svg viewBox="0 0 24 24" width={15 * s} height={15 * s} fill="none" stroke={COLORS.sky} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 1 - c }}>
          {ICONS[icon]}
        </svg>
      </span>
      <span
        style={{
          fontFamily: BODY,
          fontWeight: 700,
          fontSize: 17 * s,
          color: COLORS.ink,
          maxWidth: lerp(420 * s, 0, easeInOut(c)),
          opacity: 1 - clamp(c * 1.6),
          overflow: "hidden",
        }}
      >
        {label}
      </span>
    </div>
  );
};

/** Trait de soulignement « fait main », tracé progressivement (comme sous « collent. » sur le site) */
export const Swash: React.FC<{ t: number; tin: number; x: number; y: number; w: number; tout: number }> = ({ t, tin, x, y, w, tout }) => {
  const p = easeInOut(clamp((t - tin) / 0.75));
  const out = clamp((t - tout) / 0.35);
  if (p <= 0) return null;
  const L = 1000;
  return (
    <svg style={{ position: "absolute", left: x, top: y, overflow: "visible", opacity: 1 - out }} width={w} height={40} viewBox={`0 0 ${w} 40`}>
      <path
        d={`M6 26 C ${w * 0.22} 10, ${w * 0.45} 34, ${w * 0.62} 18 S ${w * 0.9} 12, ${w - 4} 20`}
        fill="none"
        stroke={COLORS.bubble}
        strokeWidth={15}
        strokeLinecap="round"
        pathLength={L}
        strokeDasharray={L}
        strokeDashoffset={L * (1 - p)}
      />
    </svg>
  );
};

export const Body: React.FC<{ children: React.ReactNode; size: number; color?: string; weight?: number }> = ({ children, size, color = COLORS.ink, weight = 600 }) => (
  <span style={{ fontFamily: BODY, fontWeight: weight, fontSize: size, color }}>{children}</span>
);

export { inv };
