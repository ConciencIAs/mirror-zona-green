import { Component, ChangeDetectionStrategy, signal, computed, OnInit, OnDestroy, WritableSignal } from '@angular/core';
import { RegenButton } from './regen-button';

interface Cell {
  x: number;
  y: number;
  delay: number;
}

interface RingCell {
  x: number;
  y: number;
  size: number;
  rot: number;
  delay: number;
}

interface LabCard {
  title: string;
  subtitle: string;
  icon: 'territorio' | 'salud' | 'conocimiento' | 'operacion' | 'infraestructura';
}

interface MegaCard {
  title: string;
  detail: string;
}

interface Readout {
  target: string;
  current: string;
}

interface NoiseDot {
  x: number;
  y: number;
  r: number;
  o: number;
  delay: number;
}

interface FlowLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  o: number;
}

interface DrawnPath {
  d: string;
  len: number;
}

interface PackedCircle {
  x: number;
  y: number;
  r: number;
  delay: number;
}

interface RectBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  delay: number;
}

interface TruchetTile {
  x: number;
  y: number;
  variant: 0 | 1;
}

interface SpiralDot {
  x: number;
  y: number;
  r: number;
  hue: number;
}

/**
 * Laboratorio visual — experimentos geométricos temporales.
 * Página de prueba, pensada para borrarse/ocultarse una vez que se
 * decida qué piezas pasan a integrarse al diseño real del sitio.
 */
@Component({
  selector: 'app-lab',
  standalone: true,
  imports: [RegenButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab.html',
  styleUrl: './lab.css',
})
export class Lab implements OnInit, OnDestroy {
  // ─────────────────────────────────────────────────────────
  // Núcleo matemático: un "diamante" es un rombo de Chebyshev/Manhattan
  // dentro de una casilla de `size` x `size` — la misma fórmula sirve
  // para la tira horizontal y para el anillo circular (solo cambia
  // cómo se ubica cada celda en el espacio).
  // ─────────────────────────────────────────────────────────
  private isDiamond(col: number, row: number, size: number, filled: boolean, thickness = 2): boolean {
    const c = (size - 1) / 2;
    const d = Math.abs(col - c) + Math.abs(row - c);
    const r = size / 2;
    return filled ? d <= r : d <= r && d > r - thickness;
  }

  // ─────────────────────────────────────────────────────────
  // Botón "Regenerar" genérico para TODOS los ejemplos: cada sección
  // se identifica con una clave, y su visibilidad se apaga/prende para
  // forzar a Angular a recrear el DOM y reiniciar animaciones CSS/SMIL.
  // Si el ejemplo tiene datos aleatorios, `rebuild` los vuelve a generar.
  // ─────────────────────────────────────────────────────────
  private readonly visMap = new Map<string, WritableSignal<boolean>>();

  private vis(key: string): WritableSignal<boolean> {
    let s = this.visMap.get(key);
    if (!s) {
      s = signal(true);
      this.visMap.set(key, s);
    }
    return s;
  }

  isVisible(key: string): boolean {
    return this.vis(key)();
  }

  replay(key: string, rebuild?: () => void): void {
    if (rebuild) rebuild();
    const s = this.vis(key);
    s.set(false);
    setTimeout(() => s.set(true), 50);
  }

  private seededRandom(seed: number): () => number {
    let s = Math.floor(seed) % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // ─────────────────────────────────────────────────────────
  // Sección A/B: tira horizontal (el "módulo simple")
  // ─────────────────────────────────────────────────────────
  readonly tileSize = 8;
  readonly tileCount = 14;
  readonly cellPx = 9;

  readonly stripWidth = this.tileSize * this.tileCount * this.cellPx;
  readonly stripHeight = this.tileSize * this.cellPx;

  readonly stripOutline: Cell[] = this.buildStrip(false);
  readonly stripFilled: Cell[] = this.buildStrip(true);
  // Solo las celdas interiores (relleno menos contorno) — para animar "primero el borde, luego se llena"
  readonly stripInteriorOnly: Cell[] = this.buildStripInterior();

  private buildStrip(filled: boolean): Cell[] {
    return this.buildStripGeneric(filled, this.tileSize, this.tileCount, this.cellPx);
  }

  private buildStripGeneric(filled: boolean, tileSize: number, tileCount: number, cellPx: number): Cell[] {
    const cells: Cell[] = [];
    const totalCols = tileSize * tileCount;
    for (let col = 0; col < totalCols; col++) {
      for (let row = 0; row < tileSize; row++) {
        if (this.isDiamond(col % tileSize, row, tileSize, filled)) {
          cells.push({ x: col * cellPx, y: row * cellPx, delay: col * 14 });
        }
      }
    }
    return cells;
  }

  private buildStripInterior(): Cell[] {
    const cells: Cell[] = [];
    const totalCols = this.tileSize * this.tileCount;
    for (let col = 0; col < totalCols; col++) {
      for (let row = 0; row < this.tileSize; row++) {
        const localCol = col % this.tileSize;
        const filled = this.isDiamond(localCol, row, this.tileSize, true);
        const outline = this.isDiamond(localCol, row, this.tileSize, false);
        if (filled && !outline) {
          cells.push({ x: col * this.cellPx, y: row * this.cellPx, delay: 900 + col * 14 });
        }
      }
    }
    return cells;
  }

  // ─────────────────────────────────────────────────────────
  // Sección C: mosaico interactivo — el mouse "pinta" multicolor
  // ─────────────────────────────────────────────────────────
  readonly pointer = signal<{ x: number; y: number } | null>(null);

  onMultiMove(ev: MouseEvent): void {
    const svg = ev.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const scaleX = this.stripWidth / rect.width;
    const scaleY = this.stripHeight / rect.height;
    this.pointer.set({
      x: (ev.clientX - rect.left) * scaleX,
      y: (ev.clientY - rect.top) * scaleY,
    });
  }

  onMultiLeave(): void {
    this.pointer.set(null);
  }

  colorFor(cell: Cell): string {
    const p = this.pointer();
    if (!p) return '#ffffff';
    const dx = cell.x - p.x;
    const dy = cell.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = 90;
    if (dist > radius) return '#ffffff';
    const hue = (Math.atan2(dy, dx) * 180) / Math.PI + (dist * 2);
    const light = 55 + (1 - dist / radius) * 15;
    return `hsl(${hue}, 85%, ${light}%)`;
  }

  // ─────────────────────────────────────────────────────────
  // Sección D: menú de tarjetas construido con el mismo módulo
  // ─────────────────────────────────────────────────────────
  readonly cardBorder: Cell[] = this.buildCardBorder();
  readonly cardBorderWidth = 6 * this.tileSize * this.cellPx;

  private buildCardBorder(): Cell[] {
    const cells: Cell[] = [];
    const tiles = 6;
    const totalCols = this.tileSize * tiles;
    for (let col = 0; col < totalCols; col++) {
      for (let row = 0; row < this.tileSize; row++) {
        if (this.isDiamond(col % this.tileSize, row, this.tileSize, false)) {
          cells.push({ x: col * this.cellPx, y: row * this.cellPx, delay: 0 });
        }
      }
    }
    return cells;
  }

  readonly cards: LabCard[] = [
    {
      title: 'Gobernanza Territorial',
      subtitle: "Proyecto Nasa, MANTEY YU'CE TA'SX y autoridades indígenas custodian la legitimidad del ecosistema.",
      icon: 'territorio',
    },
    {
      title: 'Salud y Acompañamiento',
      subtitle: 'IPS, médicos y sabedores ancestrales brindan orientación y cuidado integral.',
      icon: 'salud',
    },
    {
      title: 'Conocimiento e Investigación',
      subtitle: 'Universidades y laboratorios generan evidencia y mejora continua.',
      icon: 'conocimiento',
    },
    {
      title: 'Operación Regulada',
      subtitle: 'Farmacias y operadores autorizados garantizan acceso y trazabilidad.',
      icon: 'operacion',
    },
  ];

  readonly flippedCard = signal<number | null>(null);

  toggleCard(i: number): void {
    this.flippedCard.set(this.flippedCard() === i ? null : i);
  }

  // ─────────────────────────────────────────────────────────
  // Sección E/F: anillo circular — la misma tira, enrollada en polar
  // ─────────────────────────────────────────────────────────
  private buildRing(innerR: number, ringTiles: number, filled: boolean, thickness = 2, cellPx = this.cellPx): RingCell[] {
    if (innerR <= 0) {
      throw new Error(`buildRing: innerR must be positive (got ${innerR}) — cells would fold through the center`);
    }
    const angularSteps = this.tileSize * ringTiles;
    const cells: RingCell[] = [];
    for (let col = 0; col < angularSteps; col++) {
      for (let row = 0; row < this.tileSize; row++) {
        if (this.isDiamond(col % this.tileSize, row, this.tileSize, filled, thickness)) {
          const radius = innerR + row * cellPx;
          const angle = (col / angularSteps) * Math.PI * 2 - Math.PI / 2;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          const rot = (angle * 180) / Math.PI + 90;
          cells.push({ x, y, size: cellPx, rot, delay: col * 6 });
        }
      }
    }
    return cells;
  }

  readonly ringOuterR = 150;
  readonly ringInnerR = this.ringOuterR - this.tileSize * this.cellPx;
  readonly ringTiles = 14;

  readonly ringOutline: RingCell[] = this.buildRing(this.ringInnerR, this.ringTiles, false);
  readonly ringFilled: RingCell[] = this.buildRing(this.ringInnerR, this.ringTiles, true);

  // Segundo anillo (más pequeño, hacia adentro) para la variante contra-rotante.
  // Usa un paso radial (cellPx) más chico para que quepa completo antes de
  // llegar al radio 0 — un innerR negativo haría que las celdas se reflejen
  // al lado opuesto del círculo y choquen con otras (ver guarda en buildRing).
  readonly ring2CellPx = 5;
  readonly ring2InnerR = 20;
  readonly ring2Filled: RingCell[] = this.buildRing(this.ring2InnerR, 10, true, 1.6, this.ring2CellPx);

  // ─────────────────────────────────────────────────────────
  // Sección B2: construcción en LÍNEAS, cada una liderada por un
  // haz de luz — velocidad ajustable + botón para volver a verla
  // ─────────────────────────────────────────────────────────
  readonly drawSpeedMs = signal(900);
  readonly b2Visible = signal(true);

  readonly lineDiamondCount = 10;
  readonly lineDiamondR = 24;
  readonly lineDiamondGap = 16;

  readonly lineDiamonds = computed(() => {
    const r = this.lineDiamondR;
    const step = r * 2 + this.lineDiamondGap;
    const perim = 4 * r * Math.SQRT2;
    return Array.from({ length: this.lineDiamondCount }, (_, i) => {
      const cx = r + i * step;
      const path = `M${cx},0 L${cx + r},${r} L${cx},${r * 2} L${cx - r},${r} Z`;
      return { cx, cy: r, path, perim, index: i };
    });
  });

  readonly lineDiamondsWidth = this.lineDiamondCount * (this.lineDiamondR * 2 + this.lineDiamondGap);
  readonly lineDiamondsHeight = this.lineDiamondR * 2;

  onSpeedInput(ev: Event): void {
    this.drawSpeedMs.set(Number((ev.target as HTMLInputElement).value));
  }

  replayB2(): void {
    this.b2Visible.set(false);
    setTimeout(() => this.b2Visible.set(true), 50);
  }

  // ─────────────────────────────────────────────────────────
  // Sección H: menú "megapixel" — clic revela un pixel vecino con
  // la explicación. Dos variantes para comparar formas de armarlo.
  // ─────────────────────────────────────────────────────────
  readonly megaCards: MegaCard[] = [
    { title: 'GOBERNANZA', detail: 'Proyecto Nasa y autoridades indígenas custodian la legitimidad territorial del ecosistema.' },
    { title: 'SALUD', detail: 'IPS y sabedores ancestrales brindan acompañamiento integral al usuario.' },
    { title: 'CONOCIMIENTO', detail: 'Universidades y laboratorios generan evidencia y mejora continua.' },
    { title: 'OPERACIÓN', detail: 'Farmacias y operadores autorizados garantizan una dispensación trazable.' },
  ];

  private readonly megaPalette = ['#20a038', '#146424', '#3cb038', '#167f2b'];

  megaColor(i: number): string {
    return this.megaPalette[i % this.megaPalette.length];
  }

  readonly megaOpenH1 = signal<number | null>(null);
  readonly megaOpenH2 = signal<number | null>(null);

  toggleMegaH1(i: number): void {
    this.megaOpenH1.set(this.megaOpenH1() === i ? null : i);
  }

  toggleMegaH2(i: number): void {
    this.megaOpenH2.set(this.megaOpenH2() === i ? null : i);
  }

  readonly jointWidth = 8 * 2 * 4;
  readonly jointHeight = 8 * 4;
  readonly jointCells: Cell[] = this.buildStripGeneric(false, 8, 2, 4);

  // ─────────────────────────────────────────────────────────
  // Sección I: fondos generativos — mismo vocabulario, más
  // procedurales, cercanos a la estética de Processing.
  // ─────────────────────────────────────────────────────────
  private noise2(x: number, y: number, seed = 0): number {
    return (
      (Math.sin(x * 0.18 + y * 0.11 + seed) +
        Math.sin(x * 0.07 - y * 0.21 + seed * 1.3) +
        Math.sin((x + y) * 0.05 + seed * 0.7)) /
      3
    );
  }

  private buildNoiseField(cols: number, rows: number, spacing: number, seed = 0): NoiseDot[] {
    const pts: NoiseDot[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const n = this.noise2(i, j, seed);
        pts.push({
          x: i * spacing,
          y: j * spacing,
          r: 1.5 + (n + 1) * 3.2,
          o: 0.12 + (n + 1) * 0.22,
          delay: Math.abs(Math.round((i * 37 + j * 17) % 60)) * 90,
        });
      }
    }
    return pts;
  }

  private buildFlowField(cols: number, rows: number, spacing: number, seed = 0): FlowLine[] {
    const lines: FlowLine[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const n = this.noise2(i * 1.4, j * 1.4, seed);
        const angle = n * Math.PI * 2.2;
        const len = 7;
        const cx = i * spacing;
        const cy = j * spacing;
        lines.push({
          x1: cx,
          y1: cy,
          x2: cx + Math.cos(angle) * len,
          y2: cy + Math.sin(angle) * len,
          o: 0.14 + Math.abs(n) * 0.4,
        });
      }
    }
    return lines;
  }

  readonly bgCols = 34;
  readonly bgRows = 16;
  readonly bgSpacing = 17;
  readonly bgWidth = this.bgCols * this.bgSpacing;
  readonly bgHeight = this.bgRows * this.bgSpacing;

  readonly bgNoiseField = signal<NoiseDot[]>(this.buildNoiseField(this.bgCols, this.bgRows, this.bgSpacing));
  readonly bgFlowField = signal<FlowLine[]>(this.buildFlowField(this.bgCols, this.bgRows, this.bgSpacing));

  regenBgNoise(): void {
    this.bgNoiseField.set(this.buildNoiseField(this.bgCols, this.bgRows, this.bgSpacing, Math.random() * 1000));
  }

  regenBgFlow(): void {
    this.bgFlowField.set(this.buildFlowField(this.bgCols, this.bgRows, this.bgSpacing, Math.random() * 1000));
  }

  regenBgOrganic(): void {
    this.bgNoiseField.set(this.buildNoiseField(this.bgCols, this.bgRows, this.bgSpacing, Math.random() * 1000));
  }

  // ─────────────────────────────────────────────────────────
  // 9 ejemplos nuevos, estilo Processing — técnicas clásicas de arte
  // generativo, cada una con su semilla para poder regenerar.
  // ─────────────────────────────────────────────────────────

  // P1 — Truchet tiles
  readonly truchetCols = 16;
  readonly truchetRows = 8;
  readonly truchetSize = 22;
  readonly truchetWidth = this.truchetCols * this.truchetSize;
  readonly truchetHeight = this.truchetRows * this.truchetSize;
  readonly truchetTiles = signal<TruchetTile[]>(this.buildTruchet(Math.random() * 1000));

  private buildTruchet(seed: number): TruchetTile[] {
    const tiles: TruchetTile[] = [];
    for (let i = 0; i < this.truchetCols; i++) {
      for (let j = 0; j < this.truchetRows; j++) {
        const n = this.noise2(i, j, seed);
        tiles.push({ x: i * this.truchetSize, y: j * this.truchetSize, variant: n > 0 ? 1 : 0 });
      }
    }
    return tiles;
  }

  truchetPath(t: TruchetTile): string {
    const h = this.truchetSize;
    const r = h / 2;
    return t.variant === 0
      ? `M0,${r} A${r},${r} 0 0 1 ${r},0 M${r},${h} A${r},${r} 0 0 1 ${h},${r}`
      : `M0,${r} A${r},${r} 0 0 0 ${r},${h} M${r},0 A${r},${r} 0 0 0 ${h},${r}`;
  }

  regenTruchet(): void {
    this.truchetTiles.set(this.buildTruchet(Math.random() * 1000));
  }

  // P2 — Espiral de filotaxis (semillas de girasol)
  readonly phylloCount = 220;
  readonly phylloC = 9;
  readonly phyllo = signal<SpiralDot[]>(this.buildPhyllotaxis(Math.random() * 6.28));

  private buildPhyllotaxis(seedAngle: number): SpiralDot[] {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts: SpiralDot[] = [];
    for (let i = 0; i < this.phylloCount; i++) {
      const a = i * golden + seedAngle;
      const r = this.phylloC * Math.sqrt(i);
      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), r: 2 + (i / this.phylloCount) * 3.5, hue: (i * 3) % 120 + 90 });
    }
    return pts;
  }

  regenPhyllo(): void {
    this.phyllo.set(this.buildPhyllotaxis(Math.random() * 6.28));
  }

  // P3 — Empaquetado de círculos
  readonly packWidth = 320;
  readonly packHeight = 200;
  readonly packed = signal<PackedCircle[]>(this.buildCirclePacking(Math.random() * 1000));

  private buildCirclePacking(seed: number): PackedCircle[] {
    const rnd = this.seededRandom(seed);
    const circles: PackedCircle[] = [];
    let attempts = 0;
    while (circles.length < 90 && attempts < 3600) {
      attempts++;
      const x = rnd() * this.packWidth;
      const y = rnd() * this.packHeight;
      let r = 4 + rnd() * 20;
      for (const c of circles) {
        const d = Math.hypot(c.x - x, c.y - y) - c.r;
        if (d < r) r = d;
      }
      if (r > 2.5) circles.push({ x, y, r: r - 1, delay: circles.length * 25 });
    }
    return circles;
  }

  regenPacked(): void {
    this.packed.set(this.buildCirclePacking(Math.random() * 1000));
  }

  // P4 — Constelación / red de partículas
  readonly constWidth = 320;
  readonly constHeight = 200;
  readonly constData = signal(this.buildConstellation(Math.random() * 1000));

  private buildConstellation(seed: number): { pts: { x: number; y: number }[]; edges: FlowLine[] } {
    const rnd = this.seededRandom(seed);
    const pts = Array.from({ length: 46 }, () => ({ x: rnd() * this.constWidth, y: rnd() * this.constHeight }));
    const edges: FlowLine[] = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 50) edges.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[j].x, y2: pts[j].y, o: 1 - d / 50 });
      }
    }
    return { pts, edges };
  }

  regenConstellation(): void {
    this.constData.set(this.buildConstellation(Math.random() * 1000));
  }

  // P5 — Interferencia Moiré
  readonly moireRings = Array.from({ length: 14 }, (_, i) => (i + 1) * 9);

  // P6 — Subdivisión recursiva (grilla generativa)
  readonly subdivWidth = 320;
  readonly subdivHeight = 200;
  readonly subdivBlocks = signal<RectBlock[]>(this.buildSubdivision(Math.random() * 1000));

  private buildSubdivision(seed: number): RectBlock[] {
    const rnd = this.seededRandom(seed);
    const out: RectBlock[] = [];
    const palette = ['#0f1e0f', '#146424', '#20a038', '#3cb038', '#0a150a'];
    const go = (x: number, y: number, w: number, h: number, depth: number): void => {
      if (depth > 5 || w < 34 || h < 34 || rnd() < 0.22) {
        out.push({ x, y, w, h, color: palette[Math.floor(rnd() * palette.length)], delay: out.length * 60 });
        return;
      }
      if (w > h) {
        const split = w * (0.3 + rnd() * 0.4);
        go(x, y, split, h, depth + 1);
        go(x + split, y, w - split, h, depth + 1);
      } else {
        const split = h * (0.3 + rnd() * 0.4);
        go(x, y, w, split, depth + 1);
        go(x, y + split, w, h - split, depth + 1);
      }
    };
    go(0, 0, this.subdivWidth, this.subdivHeight, 0);
    return out;
  }

  regenSubdivision(): void {
    this.subdivBlocks.set(this.buildSubdivision(Math.random() * 1000));
  }

  // P7 — Curva de Lissajous / armonógrafo
  readonly lissajous = signal<DrawnPath>(this.buildLissajous(Math.random() * 6.28));

  private buildLissajous(delta: number): DrawnPath {
    const a = 3, b = 4, ampX = 140, ampY = 90, steps = 240;
    let d = '';
    let len = 0;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = ampX * Math.sin(a * t + delta);
      const y = ampY * Math.sin(b * t);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
      if (prev) len += Math.hypot(x - prev.x, y - prev.y);
      prev = { x, y };
    }
    return { d: d.trim(), len };
  }

  regenLissajous(): void {
    this.lissajous.set(this.buildLissajous(Math.random() * 6.28));
  }

  // P8 — Trazos curvos guiados por el campo de ruido (curl-ish)
  readonly curlWidth = 320;
  readonly curlHeight = 200;
  readonly curlPaths = signal<DrawnPath[]>(this.buildCurlTraces(Math.random() * 1000));

  private buildCurlTraces(seed: number): DrawnPath[] {
    const rnd = this.seededRandom(seed);
    const traces: DrawnPath[] = [];
    for (let t = 0; t < 16; t++) {
      let x = rnd() * this.curlWidth;
      let y = rnd() * this.curlHeight;
      let d = `M${x.toFixed(1)},${y.toFixed(1)} `;
      let len = 0;
      for (let i = 0; i < 22; i++) {
        const n = this.noise2(x * 0.06, y * 0.06, seed);
        const angle = n * Math.PI * 2.5;
        const nx = x + Math.cos(angle) * 6;
        const ny = y + Math.sin(angle) * 6;
        d += `L${nx.toFixed(1)},${ny.toFixed(1)} `;
        len += 6;
        x = nx;
        y = ny;
      }
      traces.push({ d: d.trim(), len });
    }
    return traces;
  }

  regenCurl(): void {
    this.curlPaths.set(this.buildCurlTraces(Math.random() * 1000));
  }

  // P9 — Ráfaga radial (sunburst)
  readonly burstCount = 72;
  readonly burstRays = signal<FlowLine[]>(this.buildBurst(Math.random() * 1000));

  private buildBurst(seed: number): FlowLine[] {
    const rays: FlowLine[] = [];
    for (let i = 0; i < this.burstCount; i++) {
      const angle = (i / this.burstCount) * Math.PI * 2;
      const n = this.noise2(i, seed);
      const len = 40 + (n + 1) * 40;
      rays.push({
        x1: 0,
        y1: 0,
        x2: Math.cos(angle) * len,
        y2: Math.sin(angle) * len,
        o: 0.22 + Math.abs(n) * 0.5,
      });
    }
    return rays;
  }

  regenBurst(): void {
    this.burstRays.set(this.buildBurst(Math.random() * 1000));
  }

  // ─────────────────────────────────────────────────────────
  // Apéndice: patrones precolombinos hechos por código — misma caja
  // de herramientas (Manhattan/polar), aplicada a motivos andinos.
  // ─────────────────────────────────────────────────────────

  // K1 — Cadena de rombos escalonados (grande, como el borde del logo)
  readonly k1Cells = signal<Cell[]>(this.buildStripGeneric(true, 8, 10, 13));
  readonly k1Width = 8 * 10 * 13;
  readonly k1Height = 8 * 13;

  regenK1(): void {
    // Determinístico — no hay azar que regenerar, solo se re-arma para volver a ver la construcción.
    this.k1Cells.set(this.buildStripGeneric(true, 8, 10, 13));
  }

  // K2 — Greca escalonada (meandro andino)
  readonly k2Cells = signal<Cell[]>(this.buildGreca());
  readonly k2Width = 26 * 12;
  readonly k2Height = 6 * 12;

  private buildGreca(): Cell[] {
    // Un meandro escalonado clásico: sube, cruza, baja, se repite.
    const px = 12;
    const pattern = [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0, 0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0];
    const cells: Cell[] = [];
    pattern.forEach((h, col) => {
      for (let row = 0; row <= h; row++) {
        cells.push({ x: col * px, y: (3 - row) * px, delay: col * 60 });
      }
    });
    return cells;
  }

  regenGreca(): void {
    this.k2Cells.set(this.buildGreca());
  }

  // K3 — Cuadrados concéntricos escalonados (motivo andino de anillos anidados)
  readonly k3Size = 13;
  readonly k3Px = 11;
  readonly k3Cells = signal<Cell[]>(this.buildNestedSquares());
  readonly k3Width = this.k3Size * this.k3Px;
  readonly k3Height = this.k3Size * this.k3Px;

  private buildNestedSquares(): Cell[] {
    const cells: Cell[] = [];
    const c = (this.k3Size - 1) / 2;
    for (let col = 0; col < this.k3Size; col++) {
      for (let row = 0; row < this.k3Size; row++) {
        const dx = Math.abs(col - c);
        const dy = Math.abs(row - c);
        const cheb = Math.max(dx, dy);
        if (Math.round(cheb) % 2 === 0) {
          cells.push({ x: col * this.k3Px, y: row * this.k3Px, delay: cheb * 90 });
        }
      }
    }
    return cells;
  }

  regenChakana(): void {
    this.k3Cells.set(this.buildNestedSquares());
  }

  // K4 — Medallón de rombos concéntricos
  readonly k4Layers = [1, 2, 3, 4, 5, 6];
  readonly k4Step = 22;

  k4Path(layer: number): string {
    const r = layer * this.k4Step;
    return `M0,${-r} L${r},0 L0,${r} L${-r},0 Z`;
  }

  // ─────────────────────────────────────────────────────────
  // Sección K: versión "Processing" de cada ejemplo A-J
  // ─────────────────────────────────────────────────────────
  noiseAt(x: number, y: number): number {
    return this.noise2(x * 0.05, y * 0.05);
  }

  // K-B: mismo borde de A, orden de aparición barajado
  readonly shuffledStrip = signal<Cell[]>(this.shuffleDelays(this.stripOutline));

  private shuffleDelays(cells: Cell[]): Cell[] {
    const delays = cells.map((c) => c.delay);
    for (let i = delays.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [delays[i], delays[j]] = [delays[j], delays[i]];
    }
    return cells.map((c, i) => ({ ...c, delay: delays[i] }));
  }

  regenShuffleDelays(): void {
    this.shuffledStrip.set(this.shuffleDelays(this.stripOutline));
  }

  // K-C: relleno ordenado por cercanía al centro de la tira
  radialDelay(cell: Cell): number {
    const cx = this.stripWidth / 2;
    const cy = this.stripHeight / 2;
    return Math.hypot(cell.x - cx, cell.y - cy) * 3;
  }

  // K-E: textura de ruido para el fondo de una tarjeta
  readonly keNoise = signal<NoiseDot[]>(
    this.buildNoiseField(this.bgCols, this.bgRows, this.bgSpacing, Math.random() * 1000),
  );

  regenKeNoise(): void {
    this.keNoise.set(this.buildNoiseField(this.bgCols, this.bgRows, this.bgSpacing, Math.random() * 1000));
  }

  // K-H: mini campo de flujo como conector entre megapixeles
  readonly keFlow: FlowLine[] = this.buildFlowField(10, 7, 10);

  // K-F/G: anillo con radio perturbado por ruido (menos perfecto, más orgánico)
  readonly noisyRing = signal<RingCell[]>(this.buildNoisyRing(Math.random() * 1000));

  private buildNoisyRing(seed: number): RingCell[] {
    const base = this.buildRing(this.ringInnerR, this.ringTiles, true);
    return base.map((c) => {
      const n = this.noise2(c.x * 0.05, c.y * 0.05, seed);
      const jitter = 1 + n * 0.22;
      return { ...c, x: c.x * jitter, y: c.y * jitter };
    });
  }

  regenNoisyRing(): void {
    this.noisyRing.set(this.buildNoisyRing(Math.random() * 1000));
  }

  // K-J: banda súper módulo con tamaño/opacidad por ruido en vez de la fórmula del diamante
  readonly organicBand = signal<NoiseDot[]>(this.buildOrganicBand(Math.random() * 1000));

  private buildOrganicBand(seed: number): NoiseDot[] {
    const cols = 40;
    const rows = 8;
    // Nota: no usar this.superBand1Width acá — ese campo se declara más abajo
    // en la clase (sección J) y todavía sería undefined en este punto del
    // orden de inicialización de campos.
    const spacing = (8 * 18 * 15) / cols;
    const pts: NoiseDot[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const n = this.noise2(i * 0.8, j * 0.8, seed);
        pts.push({ x: i * spacing, y: j * (130 / rows), r: 2 + (n + 1) * 5, o: 0.2 + (n + 1) * 0.3, delay: 0 });
      }
    }
    return pts;
  }

  regenOrganicBand(): void {
    this.organicBand.set(this.buildOrganicBand(Math.random() * 1000));
  }

  // ─────────────────────────────────────────────────────────
  // Sección J: súper módulos horizontales + datos tipo "decode"
  // ─────────────────────────────────────────────────────────
  readonly superBand1: Cell[] = this.buildStripGeneric(true, 8, 18, 15);
  readonly superBand1Width = 8 * 18 * 15;
  readonly superBand1Height = 8 * 15;

  readonly superBand2: Cell[] = this.buildStripGeneric(false, 8, 22, 12);
  readonly superBand2Width = 8 * 22 * 12;
  readonly superBand2Height = 8 * 12;

  private readonly glyphPool =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789云生态智健康座標愛心光速数据网络';

  readonly readouts = signal<Readout[]>([
    { target: 'N04°35\'12.4" W74°04\'51.7"', current: '' },
    { target: '座標 4.6097,-74.0817', current: '' },
    { target: 'TRAZA-88226D39', current: '' },
    { target: '云端 · 生态系统 · 0xF3A9', current: '' },
    { target: '健康 · SALUD · 智慧', current: '' },
  ]);

  private decodeTimer?: ReturnType<typeof setInterval>;
  private decodeProgress: number[] = [];
  private decodePause: number[] = [];

  ngOnInit(): void {
    const list = this.readouts();
    this.decodeProgress = list.map(() => 0);
    this.decodePause = list.map(() => 0);

    this.decodeTimer = setInterval(() => {
      const current = this.readouts();
      const next = current.map((r, idx) => {
        if (this.decodeProgress[idx] >= r.target.length) {
          this.decodePause[idx]++;
          if (this.decodePause[idx] > 45) {
            this.decodeProgress[idx] = 0;
            this.decodePause[idx] = 0;
          }
          return r;
        }
        if (Math.random() < 0.35) this.decodeProgress[idx]++;
        const revealed = r.target.slice(0, this.decodeProgress[idx]);
        const scrambledLen = r.target.length - this.decodeProgress[idx];
        let scrambled = '';
        for (let k = 0; k < scrambledLen; k++) {
          scrambled += this.glyphPool[Math.floor(Math.random() * this.glyphPool.length)];
        }
        return { target: r.target, current: revealed + scrambled };
      });
      this.readouts.set(next);
    }, 90);
  }

  ngOnDestroy(): void {
    if (this.decodeTimer) clearInterval(this.decodeTimer);
  }
}
