import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FPS } from "../timing";
import { CHIPS, LOGO, clamp, easeIn, easeInOut, easeOut, easeOutExpo, inv, lerp, projectOnBubble, springOut } from "../world";
import { BODY, COLORS, DISPLAY, loadFonts } from "./fonts";
import { ChipPill, Eyebrow, Kinetic, RollWord, Swash } from "./Kinetic";

const X = 84; // marge gauche
const Y = 300; // haut de la zone titre (zone sûre : rien d'important au-dessus de 150 px)

/** Flou de mouvement réel de la typo : N rendus décalés dans le temps, additionnés (plus-lighter). */
export const Accum: React.FC<{ samples: number; render: (t: number) => React.ReactNode }> = ({ samples, render }) => {
  const frame = useCurrentFrame();
  const t0 = frame / FPS;
  const shutter = 0.5 / FPS;
  const copies = [];
  for (let i = 0; i < samples; i++) {
    let t = t0 + ((i + 0.5) / samples - 0.5) * shutter;
    // pas de flou à travers une coupe franche
    for (const cut of [C.cut, C.cut2]) {
      if (t0 >= cut && t < cut) t = cut;
      if (t0 < cut && t >= cut) t = cut - 1e-4;
    }
    copies.push(
      <AbsoluteFill key={i} style={{ mixBlendMode: samples > 1 ? "plus-lighter" : "normal", opacity: 1 / samples }}>
        {render(t)}
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ isolation: "isolate" }}>{copies}</AbsoluteFill>;
};

const accrocheShake = (t: number) => (t > C.acc ? 3.2 * easeIn(inv(C.acc, C.drop, t)) : 0);

function Chips({ t }: { t: number }) {
  if (t < C.svc || t >= C.drop + 0.12) return null;
  return (
    <>
      {CHIPS.map((c, i) => {
        const at = C.chips[i];
        const start = at - 0.42;
        if (t < start) return null;
        const anchor = projectOnBubble(t, c.dir as unknown as number[], 1.03);
        // vol d'arrivée depuis le bord de l'écran, avec une légère courbe
        const fly = easeOutExpo(clamp((t - start) / 0.42));
        const fromX = c.from[0] === 0 ? anchor.x : c.from[0] < 0 ? -320 : 1400;
        const fromY = c.from[0] === 0 ? -200 : anchor.y + c.from[1] * 500;
        const x = lerp(fromX, anchor.x, fly);
        const y = lerp(fromY, anchor.y, fly) - Math.sin(fly * Math.PI) * 60;
        // impact : petit écrasement de la pastille
        const hit = t > at ? springOut(clamp((t - at) / 0.5), 10, 0.3) : 1;
        const squash = t > at ? 1 + (1 - hit) * 0.25 : 1;
        const collapse = easeInOut(clamp((t - at - 0.62) / 0.36));
        // les points collés passent derrière la bulle quand elle tourne
        const behind = clamp((0.08 - anchor.facing) / 0.16);
        // à l'éclatement, les points sautent avec la bulle
        const pop = t > C.drop ? 1 - clamp((t - C.drop) / 0.1) : 1;
        const s = (0.92 + 0.08 * fly) * pop;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `scale(${(s * squash).toFixed(4)}, ${(s / squash).toFixed(4)})`,
              opacity: (collapse > 0.5 ? 1 - behind : 1) * pop,
              zIndex: collapse > 0.5 ? 0 : 2,
            }}
          >
            <ChipPill label={c.label} icon={c.icon} collapse={collapse} />
          </div>
        );
      })}
    </>
  );
}

function EndCard({ t }: { t: number }) {
  if (t < C.end + 0.55) return null;
  const lt = t - (C.end + 0.62);
  const letters = [..."mimi"];
  const cta = springOut(clamp((t - C.end - 1.05) / 0.9), 8, 0.36);
  const ctaOp = clamp((t - C.end - 1.05) / 0.25);
  return (
    <>
      <div style={{ position: "absolute", left: LOGO.textLeft, top: LOGO.top, height: LOGO.font, overflow: "hidden", padding: "0 10px 40px", margin: "0 -10px" }}>
        {letters.map((ch, i) => {
          const p = clamp((lt - i * 0.05) / 0.7);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontFamily: DISPLAY,
                fontSize: LOGO.font,
                lineHeight: 1,
                color: COLORS.ink,
                letterSpacing: "-0.05em",
                fontVariationSettings: `"wght" ${lerp(500, 900, easeOut(p)).toFixed(1)}, "SOFT" 100, "WONK" 1, "opsz" 144`,
                transform: `translateY(${((1 - easeOutExpo(p)) * 105).toFixed(2)}%) scaleY(${lerp(1.3, 1, springOut(p, 8, 0.33)).toFixed(4)})`,
                transformOrigin: "50% 100%",
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, width: 1080, top: 1112, display: "flex", justifyContent: "center", opacity: ctaOp }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 20,
            height: 116,
            padding: "0 52px 0 30px",
            borderRadius: 999,
            background: COLORS.sky,
            color: COLORS.paper,
            fontFamily: BODY,
            fontWeight: 700,
            fontSize: 44,
            transform: `scale(${lerp(0.6, 1, cta).toFixed(4)})`,
            boxShadow: "0 26px 50px -22px rgba(0,117,153,0.75)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(255,255,255,0.14)", display: "grid", placeItems: "center" }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: COLORS.bubble, boxShadow: `0 0 0 ${(6 * (0.5 + 0.5 * Math.sin(t * 5))).toFixed(2)}px rgba(243,162,190,0.35)` }} />
          </span>
          Réserver mon audit offert
        </div>
      </div>
    </>
  );
}

export function typeAt(t: number) {
  const before = (x: number) => t < x; // coupe franche : le texte disparaît net
  return (
    <AbsoluteFill>
      {/* 0 — ouverture */}
      <Eyebrow t={t} tin={0.2} tout={C.t1 - 0.3} text="Agence marketing" x={X} y={Y + 40} />

      {/* 1 — le constat */}
      <Kinetic t={t} tin={C.t1} tout={C.t2 - 0.34} lines={[[{ text: "Votre marque" }], [{ text: "mérite mieux" }]]} x={X} y={Y} size={150} />
      <Kinetic t={t} tin={C.t2} tout={C.t3 - 0.3} lines={[[{ text: "que des posts" }], [{ text: "qu’on oublie" }]]} x={X} y={Y} size={150} />
      <Kinetic
        t={t}
        tin={C.t3}
        tout={C.svc - 0.32}
        lines={[[{ text: "en " }, { text: "trois", em: true }], [{ text: "secondes.", em: true }]]}
        x={X}
        y={Y}
        size={172}
        exit="fade"
        forget={{ word: "secondes", at: C.t3 + 1.05 }}
      />

      {/* 2 — les services collent à la bulle */}
      <Eyebrow t={t} tin={C.svc} tout={C.r0 - 0.3} text="Services" x={X} y={Y + 10} />
      <Chips t={t} />

      {/* 3 — remarque / retienne / achète */}
      {before(C.cut) && (
        <>
          <Kinetic t={t} tin={C.r0 - 0.05} tout={99} lines={[[{ text: "qu’on vous" }]]} x={X} y={Y} size={150} exit="none" />
          <RollWord
            t={t}
            tout={99}
            x={X}
            y={Y + 152}
            size={172}
            words={[
              { text: "remarque.", at: C.r0 + 0.1 },
              { text: "retienne.", at: C.r1 },
              { text: "achète.", at: C.r2 },
            ]}
          />
        </>
      )}

      {/* 4 — coupe franche : le principe */}
      {!before(C.cut) && before(C.drop) && (
        <>
          <Kinetic t={t} tin={C.cut + 0.06} tout={C.acc - 0.32} lines={[[{ text: "Le principe du" }], [{ text: "chewing-gum :" }]]} x={X} y={Y} size={138} stagger={0.022} />
          <Kinetic t={t} tin={C.acc} tout={99} lines={[[{ text: "ça " }, { text: "accroche,", em: true }]]} x={X} y={Y} size={190} exit="none" shake={accrocheShake} />
        </>
      )}

      {/* 5 — drop : ça ne se décolle plus */}
      {!before(C.cut2) && (
        <Kinetic
          t={t}
          tin={C.cut2 + 0.02}
          tout={C.regrow - 0.45}
          lines={[[{ text: "et ça ne se" }], [{ text: "décolle", em: true }, { text: " plus." }]]}
          x={X}
          y={Y}
          size={150}
          style="stretch"
          stagger={0.03}
          exit="up"
        />
      )}

      {/* 6 — elle revient toujours */}
      <Kinetic t={t} tin={C.regrow + 0.1} tout={C.rev2 - 0.3} lines={[[{ text: "Elle revient" }], [{ text: "toujours." }]]} x={X} y={Y} size={150} />
      <Kinetic t={t} tin={C.rev2} tout={C.title - 0.34} lines={[[{ text: "Comme vos" }], [{ text: "clients.", em: true }]]} x={X} y={Y} size={150} />

      {/* 7 — signature */}
      <Kinetic
        t={t}
        tin={C.title}
        tout={C.offer - 0.36}
        lines={[[{ text: "Des marques" }], [{ text: "qui " }, { text: "collent.", em: true }]]}
        x={X}
        y={Y}
        size={168}
        stagger={0.034}
      />
      <Swash t={t} tin={C.title + 0.85} tout={C.offer - 0.36} x={X + 300} y={Y + 326} w={460} />

      {/* 8 — l'offre */}
      <Eyebrow t={t} tin={C.offer} tout={C.offer2 - 0.25} text="Sans engagement" x={X} y={Y - 40} />
      <Kinetic t={t} tin={C.offer + 0.08} tout={C.offer2 - 0.3} lines={[[{ text: "Audit" }], [{ text: "offert.", em: true }]]} x={X} y={Y + 30} size={196} />
      <Kinetic t={t} tin={C.offer2} tout={C.end - 0.3} lines={[[{ text: "Réponse sous" }], [{ text: "24 h ouvrées.", em: true }]]} x={X} y={Y} size={138} />

      {/* 9 — fin : la bulle devient le point du logo */}
      <EndCard t={t} />
    </AbsoluteFill>
  );
}

export const TypeLayer: React.FC<{ samples?: number }> = ({ samples = 8 }) => {
  loadFonts();
  return <Accum samples={samples} render={typeAt} />;
};

// ---------- sous-titres (version « sans le son ») ----------
export const SUBS: { a: number; b: number; text: string }[] = [
  { a: C.t1 - 0.1, b: C.svc - 0.05, text: "Votre marque mérite mieux que des posts qu’on oublie en trois secondes." },
  { a: C.svc, b: C.r0 - 0.05, text: "MIMI conçoit vos publicités, vos contenus et votre site," },
  { a: C.r0, b: C.cut, text: "pour qu’on vous remarque, qu’on vous retienne, et qu’on vous achète." },
  { a: C.cut, b: C.cut2, text: "Le principe du chewing-gum : ça accroche," },
  { a: C.cut2, b: C.regrow - 0.05, text: "et ça ne se décolle plus." },
  { a: C.regrow, b: C.title - 0.05, text: "Elle revient toujours. Comme vos clients." },
  { a: C.title, b: C.offer - 0.05, text: "MIMI. Des marques qui collent." },
  { a: C.offer, b: C.end - 0.05, text: "Audit offert, sans engagement. Réponse sous 24 h ouvrées." },
];

export const Subtitles: React.FC = () => {
  loadFonts();
  const t = useCurrentFrame() / FPS;
  const s = SUBS.find((x) => t >= x.a && t < x.b);
  if (!s) return null;
  const pin = easeOut(clamp((t - s.a) / 0.18));
  const pout = clamp((t - (s.b - 0.12)) / 0.12);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 70, right: 70, bottom: 1920 - 1680, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            maxWidth: 900,
            padding: "16px 30px 18px",
            borderRadius: 26,
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 18px 40px -24px rgba(107,30,64,0.55)",
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: 44,
            lineHeight: 1.22,
            color: COLORS.ink,
            textAlign: "center",
            textWrap: "balance" as any,
            opacity: pin * (1 - pout),
            transform: `translateY(${((1 - pin) * 14).toFixed(2)}px)`,
          }}
        >
          {s.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

void easeInOut;
