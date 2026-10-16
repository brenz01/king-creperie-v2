'use client';

import { useEffect, useRef, useState } from 'react';

// Le moment signature de l'accueil (1,6 s, une seule fois) : une louche
// de pâte tombe sur la plaque, le râteau l'étale, la crêpe dore puis la
// vraie photo apparaît. Sans animation (réglage système), la photo est
// affichée directement. La vidéo ne se charge qu'ensuite, et seulement
// si la connexion le permet (forfaits data).
export default function PlaqueAccueil() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [revele, setRevele] = useState(false);
  const [video, setVideo] = useState(false);

  useEffect(() => {
    const cv = canvas.current;
    const cx = cv?.getContext('2d');
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const videoPermise = !reduit && !conn?.saveData && (!conn?.effectiveType || conn.effectiveType === '4g');
    let image = 0;
    let minuteur = 0;

    const finir = () => {
      setRevele(true);
      if (videoPermise) minuteur = window.setTimeout(() => setVideo(true), 900);
    };

    if (!cv || !cx || reduit) {
      image = requestAnimationFrame(finir);
      return () => {
        cancelAnimationFrame(image);
        clearTimeout(minuteur);
      };
    }

    const T = 600;
    const C = T / 2;
    const R = C * 0.92;
    cv.width = T;
    cv.height = T;
    const taches = Array.from({ length: 60 }, () => {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * (R - 16);
      return { x: C + d * Math.cos(a), y: C + d * Math.sin(a), r: 2 + Math.random() * 9, o: 0.4 + Math.random() * 0.6 };
    });

    const pate = (r: number, cuisson: number, angle: number | null) => {
      cx.clearRect(0, 0, T, T);
      cx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
        const rr = r * (1 + 0.016 * Math.sin(a * 7 + 1.3) + 0.01 * Math.sin(a * 13));
        const x = C + rr * Math.cos(a);
        const y = C + rr * Math.sin(a);
        if (a === 0) cx.moveTo(x, y);
        else cx.lineTo(x, y);
      }
      const m = (b: number, d: number) => Math.round(b + (d - b) * cuisson);
      const g = cx.createRadialGradient(C, C, 0, C, C, Math.max(r, 1));
      g.addColorStop(0, `rgb(${m(247, 222)},${m(230, 160)},${m(167, 74)})`);
      g.addColorStop(1, `rgb(${m(240, 190)},${m(214, 120)},${m(150, 48)})`);
      cx.fillStyle = g;
      cx.fill();
      if (cuisson > 0) {
        for (const t of taches) {
          if (Math.hypot(t.x - C, t.y - C) > r - 10) continue;
          cx.beginPath();
          cx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
          cx.fillStyle = `rgba(122,62,20,${0.5 * cuisson * t.o})`;
          cx.fill();
        }
      }
      if (angle !== null) {
        cx.save();
        cx.translate(C, C);
        cx.rotate(angle);
        cx.fillStyle = 'rgba(210,170,120,0.95)';
        cx.fillRect(-4, -r * 0.94, 8, r * 1.88);
        cx.fillStyle = 'rgba(110,72,40,0.95)';
        cx.fillRect(-13, -6, 26, 12);
        cx.restore();
      }
    };

    const t0 = performance.now();
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    const frame = (t: number) => {
      // Le premier horodatage rAF peut précéder t0 : on borne à 0.
      const e = Math.max(0, (t - t0) / 1000);
      if (e < 0.45) pate(R * 0.5 * ease(e / 0.45), 0, null);
      else if (e < 1.05) pate(R * (0.5 + 0.5 * ease((e - 0.45) / 0.6)), 0, ((e - 0.45) / 0.6) * Math.PI * 2);
      else if (e < 1.6) pate(R, ease((e - 1.05) / 0.55), null);
      else {
        pate(R, 1, null);
        finir();
        return;
      }
      image = requestAnimationFrame(frame);
    };
    image = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(image);
      clearTimeout(minuteur);
    };
  }, []);

  return (
    <div className="relative w-full h-full rounded-full overflow-hidden bg-kc-nuit">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/videos/hero-poster.jpg"
        alt="Une crêpe au Nutella roulée, tenue à la main"
        width={720}
        height={720}
        fetchPriority="high"
        className={`absolute inset-0 w-full h-full object-cover scale-110 transition-opacity duration-500 ${revele ? 'opacity-100' : 'opacity-0'}`}
      />
      {video && (
        <video
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
          className="kc-fondu absolute inset-0 w-full h-full object-cover scale-110"
        >
          <source src="/videos/hero-bg.webm" type="video/webm" />
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>
      )}
      <canvas
        ref={canvas}
        aria-hidden
        className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${revele ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}
