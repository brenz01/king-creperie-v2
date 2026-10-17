'use client';

import { useState } from 'react';

// Commandes par heure : barres pour aujourd'hui, ligne pointillée pour le
// même jour la semaine dernière (deux formes de marque : l'identité ne
// tient pas qu'à la couleur). Couleurs validées (dataviz, surface sombre).
const AUJOURDHUI = '#d97706';
const SEMAINE_DERNIERE = '#a8a29e';

const L = 600;
const H = 168;
const MARGE = { haut: 12, bas: 26, gauche: 8, droite: 8 };

export default function GraphiqueHeures({
  aujourdhui,
  semaineDerniere,
  plage,
}: {
  aujourdhui: number[];
  semaineDerniere: number[];
  plage: [number, number];
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const heures = Array.from({ length: plage[1] - plage[0] + 1 }, (_, i) => plage[0] + i);
  const max = Math.max(2, ...heures.map((h) => Math.max(aujourdhui[h], semaineDerniere[h])));
  const largeurCol = (L - MARGE.gauche - MARGE.droite) / heures.length;
  const largeurBarre = Math.max(4, Math.min(22, largeurCol - 6));
  const y = (v: number) => MARGE.haut + (H - MARGE.haut - MARGE.bas) * (1 - v / max);
  const xCentre = (i: number) => MARGE.gauche + largeurCol * i + largeurCol / 2;
  const base = y(0);

  const points = heures.map((h, i) => `${xCentre(i)},${y(semaineDerniere[h])}`).join(' ');
  const info = survol !== null ? heures[survol] : null;

  return (
    <figure className="relative">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-kc-sable">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: AUJOURDHUI }} aria-hidden /> Aujourd’hui
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line x1="1" y1="4" x2="17" y2="4" stroke={SEMAINE_DERNIERE} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          Même jour, semaine dernière
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${L} ${H}`} className="mt-3 w-full h-auto" role="img" aria-label="Commandes par heure" onMouseLeave={() => setSurvol(null)}>
        {/* Repères discrets : la moitié et le maximum. */}
        {[max / 2, max].map((v) => (
          <g key={v}>
            <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={y(v)} y2={y(v)} stroke="#3d332a" strokeWidth="1" />
            <text x={L - MARGE.droite} y={y(v) - 4} textAnchor="end" className="fill-kc-sable" fontSize="11">
              {Math.round(v)}
            </text>
          </g>
        ))}
        <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={base} y2={base} stroke="#57534e" strokeWidth="1" />

        {heures.map((h, i) => {
          const v = aujourdhui[h];
          const haut = Math.max(6, base - y(v));
          return (
            <g key={h}>
              {v > 0 && (
                <path
                  // Barre ancrée à la base, coins arrondis (4 px) en haut seulement.
                  d={`M${xCentre(i) - largeurBarre / 2},${base} v${-(haut - 4)} q0,-4 4,-4 h${largeurBarre - 8} q4,0 4,4 v${haut - 4} z`}
                  fill={AUJOURDHUI}
                  opacity={survol === null || survol === i ? 1 : 0.55}
                />
              )}
              {(h % 2 === 0 || heures.length <= 8) && (
                <text x={xCentre(i)} y={H - 8} textAnchor="middle" className="fill-kc-sable" fontSize="11">
                  {h} h
                </text>
              )}
            </g>
          );
        })}

        <polyline points={points} fill="none" stroke={SEMAINE_DERNIERE} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
        {heures.map((h, i) =>
          semaineDerniere[h] > 0 ? (
            <circle key={h} cx={xCentre(i)} cy={y(semaineDerniere[h])} r="4" fill={SEMAINE_DERNIERE} stroke="#26201a" strokeWidth="2" />
          ) : null,
        )}

        {/* Zones de survol / focus, plus larges que les barres. */}
        {heures.map((h, i) => (
          <rect
            key={h}
            x={MARGE.gauche + largeurCol * i}
            y={0}
            width={largeurCol}
            height={H}
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={`${h} h : ${aujourdhui[h]} aujourd’hui, ${semaineDerniere[h]} la semaine dernière`}
            onMouseEnter={() => setSurvol(i)}
            onFocus={() => setSurvol(i)}
            onBlur={() => setSurvol(null)}
            className="outline-none focus-visible:stroke-amber-400 focus-visible:[stroke-width:2]"
          />
        ))}
      </svg>

      {info !== null && survol !== null && (
        <div
          className="kc-fondu pointer-events-none absolute top-8 z-10 rounded-lg border border-kc-bord bg-kc-nuit px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(0px, calc(${((xCentre(survol) / L) * 100).toFixed(2)}% - 70px), calc(100% - 140px))` }}
        >
          <p className="font-semibold text-kc-creme">{info} h – {info + 1} h</p>
          <p className="mt-0.5 text-kc-sable">
            Aujourd’hui : <span className="font-semibold text-kc-creme">{aujourdhui[info]}</span>
          </p>
          <p className="text-kc-sable">
            Semaine dernière : <span className="font-semibold text-kc-creme">{semaineDerniere[info]}</span>
          </p>
        </div>
      )}

      {/* Les mêmes chiffres en tableau, pour les lecteurs d'écran. */}
      <div className="sr-only">
      <table>
        <caption>Commandes par heure</caption>
        <thead>
          <tr>
            <th scope="col">Heure</th>
            <th scope="col">Aujourd’hui</th>
            <th scope="col">Semaine dernière</th>
          </tr>
        </thead>
        <tbody>
          {heures.map((h) => (
            <tr key={h}>
              <th scope="row">{h} h</th>
              <td>{aujourdhui[h]}</td>
              <td>{semaineDerniere[h]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
