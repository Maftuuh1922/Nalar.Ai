/**
 * Local renderer for legacy drawio diagrams (mxfile XML) → SVG.
 *
 * The backend prompt used to ask models for Draw.io XML instead of Mermaid, so
 * chat history still holds ```drawio blocks. Previewing those through the
 * diagrams.net embed needs a cross-origin iframe plus a postMessage handshake,
 * which fails outright in sandboxed preview panes and offline. Since the XML
 * these chats contain is simple, it is drawn directly instead — no iframe, no
 * network, no third party.
 *
 * The supported vocabulary is deliberately narrow: rectangles (optionally
 * rounded), ellipses, rhombi, and orthogonal edges, styled via the mxCell
 * ``style`` attribute. That spans every drawio diagram in existing history.
 * Anything outside it degrades to the "open in diagrams.net" escape hatch.
 *
 * Parsing is done with a small scanner rather than DOMParser so the module
 * stays usable outside the browser (notably in the node test runner).
 */

export interface DrawioNode {
  id: string;
  kind: "rect" | "ellipse" | "rhombus";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  fontColor: string;
  fontSize: number;
  rounded: boolean;
}

export interface DrawioEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  exitX?: number;
  exitY?: number;
  entryX?: number;
  entryY?: number;
  stroke: string;
}

export interface DrawioDiagram {
  nodes: DrawioNode[];
  edges: DrawioEdge[];
}

const DEFAULT_FILL = "#ffffff";
const DEFAULT_STROKE = "#333333";
const DEFAULT_FONT_COLOR = "#1f2937";
const DEFAULT_FONT_SIZE = 12;

/** Padding around the diagram bounds, in diagram units. */
const PADDING = 24;
/** How far an orthogonal edge runs straight out of its anchor before turning. */
const ELBOW = 20;

const CELL_RE = /<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g;
const GEOMETRY_RE = /<mxGeometry\b([^>]*?)\/?>/;
const ATTR_RE = /([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g;

type Attrs = Record<string, string>;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseAttrs(source: string): Attrs {
  const out: Attrs = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(source)) !== null) {
    const key = m[1] ?? m[3];
    const value = m[2] ?? m[4] ?? "";
    if (key) out[key] = value;
  }
  return out;
}

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionalNum(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Split a drawio style string into its `key=value` pairs plus bare flags. */
function parseStyle(style: string): { keys: Map<string, string>; flags: Set<string> } {
  const keys = new Map<string, string>();
  const flags = new Set<string>();
  for (const partRaw of style.split(";")) {
    const part = partRaw.trim();
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) flags.add(part);
    else keys.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return { keys, flags };
}

function color(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const v = value.trim();
  if (v.toLowerCase() === "none") return "none";
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  return fallback;
}

/**
 * Reduce a drawio label to plain text.
 *
 * With `html=1` the label holds real HTML, stored XML-escaped in the `value`
 * attribute — a line break arrives as `&lt;br&gt;`. So entities are decoded
 * first, then tags are stripped; doing it the other way round would leave the
 * markup visible as literal text. A second decode handles labels that were
 * escaped twice. Output is plain text and is escaped again at render time.
 */
function plainLabel(value: string): string {
  const html = decodeEntities(value);
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Reduce a raw ```drawio block body to bare mxfile XML.
 *
 * Models do not always emit a clean block: the XML can arrive with each line
 * wrapped in inline backticks, with a stray fence or a lone `drawio` language
 * line inside the body, or HTML-escaped. Any of those would otherwise fail the
 * `<mxfile` sniff and render as an error card.
 */
export function normalizeDrawioXml(raw: string): string {
  let s = raw.replace(/\r\n?/g, "\n");
  s = s.replace(/^\s*```[\w-]*\s*$/gm, "");
  s = s.replace(/^\s*drawio\s*$/gim, "");
  // Per-line inline code wrapping: `<mxCell .../>` on every line.
  s = s.replace(/^[ \t]*`(.*)`[ \t]*$/gm, "$1");
  s = s.trim();
  if (!s.includes("<mx") && s.includes("&lt;mx")) s = decodeEntities(s);
  return s.trim();
}

export function looksLikeDrawioXml(raw: string): boolean {
  const head = normalizeDrawioXml(raw).trimStart();
  return head.startsWith("<mxfile") || head.startsWith("<mxGraphModel");
}

export function parseDrawioXml(rawXml: string): DrawioDiagram {
  const xml = normalizeDrawioXml(rawXml);
  const nodes: DrawioNode[] = [];
  const edges: DrawioEdge[] = [];

  CELL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CELL_RE.exec(xml)) !== null) {
    const attrs = parseAttrs(match[1] ?? "");
    const body = match[2] ?? "";
    const id = attrs.id;
    if (!id || id === "0" || id === "1") continue;

    const style = decodeEntities(attrs.style ?? "");
    const { keys, flags } = parseStyle(style);
    const label = plainLabel(attrs.value ?? "");

    if (attrs.edge === "1") {
      if (!attrs.source || !attrs.target) continue;
      edges.push({
        id,
        source: attrs.source,
        target: attrs.target,
        label,
        exitX: optionalNum(keys.get("exitX")),
        exitY: optionalNum(keys.get("exitY")),
        entryX: optionalNum(keys.get("entryX")),
        entryY: optionalNum(keys.get("entryY")),
        stroke: color(keys.get("strokeColor"), DEFAULT_STROKE),
      });
      continue;
    }

    if (attrs.vertex !== "1") continue;

    const geometry = GEOMETRY_RE.exec(body);
    if (!geometry) continue;
    const geo = parseAttrs(geometry[1] ?? "");
    const width = num(geo.width, 0);
    const height = num(geo.height, 0);
    if (width <= 0 || height <= 0) continue;

    let kind: DrawioNode["kind"] = "rect";
    if (flags.has("ellipse") || keys.get("shape") === "ellipse") kind = "ellipse";
    else if (flags.has("rhombus") || keys.get("shape") === "rhombus") kind = "rhombus";

    nodes.push({
      id,
      kind,
      label,
      x: num(geo.x, 0),
      y: num(geo.y, 0),
      width,
      height,
      fill: color(keys.get("fillColor"), DEFAULT_FILL),
      stroke: color(keys.get("strokeColor"), DEFAULT_STROKE),
      fontColor: color(keys.get("fontColor"), DEFAULT_FONT_COLOR),
      fontSize: num(keys.get("fontSize"), DEFAULT_FONT_SIZE),
      rounded: keys.get("rounded") === "1",
    });
  }

  const known = new Set(nodes.map((n) => n.id));
  return { nodes, edges: edges.filter((e) => known.has(e.source) && known.has(e.target)) };
}

interface Point {
  x: number;
  y: number;
}

/** Anchor point on a node, from a drawio exit/entry fraction pair. */
function anchor(node: DrawioNode, fx: number, fy: number): Point {
  return { x: node.x + fx * node.width, y: node.y + fy * node.height };
}

/**
 * Pick anchors when the edge does not declare them: leave the source and enter
 * the target on whichever axis separates them most, which is what drawio's own
 * floating connections approximate.
 */
function implicitAnchors(
  source: DrawioNode,
  target: DrawioNode,
): { exit: Point; entry: Point } {
  const sc = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  if (Math.abs(tc.y - sc.y) >= Math.abs(tc.x - sc.x)) {
    return tc.y >= sc.y
      ? { exit: anchor(source, 0.5, 1), entry: anchor(target, 0.5, 0) }
      : { exit: anchor(source, 0.5, 0), entry: anchor(target, 0.5, 1) };
  }
  return tc.x >= sc.x
    ? { exit: anchor(source, 1, 0.5), entry: anchor(target, 0, 0.5) }
    : { exit: anchor(source, 0, 0.5), entry: anchor(target, 1, 0.5) };
}

/**
 * Route an orthogonal polyline between two anchors.
 *
 * Which axis leads is decided by the exit anchor: leaving through the top or
 * bottom edge means the first segment is vertical, leaving through a side
 * means it is horizontal. A dog-leg is only inserted when the endpoints are
 * actually offset, so aligned nodes get a clean straight line.
 */
function routeEdge(start: Point, end: Point, verticalFirst: boolean): Point[] {
  if (start.x === end.x || start.y === end.y) return [start, end];

  if (verticalFirst) {
    const midY = Math.abs(end.y - start.y) > ELBOW * 2
      ? (start.y + end.y) / 2
      : start.y + Math.sign(end.y - start.y) * ELBOW;
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
  }
  const midX = Math.abs(end.x - start.x) > ELBOW * 2
    ? (start.x + end.x) / 2
    : start.x + Math.sign(end.x - start.x) * ELBOW;
  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
}

/** Greedy word wrap using an average glyph width — good enough for labels. */
function wrapLabel(label: string, width: number, fontSize: number): string[] {
  if (!label) return [];
  const usable = Math.max(width - 12, 24);
  const perChar = fontSize * 0.58;
  const maxChars = Math.max(Math.floor(usable / perChar), 6);

  const lines: string[] = [];
  for (const paragraph of label.split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
    }
    lines.push(current);
  }
  return lines.filter((l) => l !== "");
}

function labelMarkup(
  text: string,
  cx: number,
  cy: number,
  width: number,
  fontSize: number,
  fill: string,
  extraAttrs = "",
): string {
  const lines = wrapLabel(text, width, fontSize);
  if (lines.length === 0) return "";
  const lineHeight = fontSize * 1.25;
  const top = cy - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.34;
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${cx}" y="${round(top + i * lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  return `<text text-anchor="middle" font-size="${fontSize}" fill="${fill}" font-family="Helvetica, Arial, sans-serif"${extraAttrs}>${tspans}</text>`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function pointsToPath(points: Point[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${round(p.x)} ${round(p.y)}`)
    .join(" ");
}

function arrowHead(points: Point[], color: string): string {
  const end = points[points.length - 1];
  const prev = points[points.length - 2] ?? end;
  const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
  const length = 9;
  const half = 4;
  const baseX = end.x - length * Math.cos(angle);
  const baseY = end.y - length * Math.sin(angle);
  const p1 = { x: baseX - half * Math.sin(-angle), y: baseY - half * Math.cos(-angle) };
  const p2 = { x: baseX + half * Math.sin(-angle), y: baseY + half * Math.cos(-angle) };
  return `<polygon points="${round(end.x)},${round(end.y)} ${round(p1.x)},${round(p1.y)} ${round(p2.x)},${round(p2.y)}" fill="${color}" />`;
}

/**
 * Render mxfile XML to a standalone SVG string.
 *
 * Returns an empty string when the XML holds no drawable vertex, which the
 * caller treats as "cannot preview this" rather than as a hard failure.
 */
export function drawioXmlToSvg(rawXml: string): string {
  const { nodes, edges } = parseDrawioXml(rawXml);
  if (nodes.length === 0) return "";

  const byId = new Map(nodes.map((n) => [n.id, n]));

  const edgeMarkup: string[] = [];
  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;

    const declared =
      edge.exitX !== undefined &&
      edge.exitY !== undefined &&
      edge.entryX !== undefined &&
      edge.entryY !== undefined;

    const { exit, entry } = declared
      ? {
          exit: anchor(source, edge.exitX as number, edge.exitY as number),
          entry: anchor(target, edge.entryX as number, edge.entryY as number),
        }
      : implicitAnchors(source, target);

    const verticalFirst = declared
      ? edge.exitY === 0 || edge.exitY === 1
      : Math.abs(entry.y - exit.y) >= Math.abs(entry.x - exit.x);

    const points = routeEdge(exit, entry, verticalFirst);
    edgeMarkup.push(
      `<path d="${pointsToPath(points)}" fill="none" stroke="${edge.stroke}" stroke-width="1.5" stroke-linejoin="round" />`,
      arrowHead(points, edge.stroke),
    );

    if (edge.label) {
      // Anchor the label to the middle of the route's longest segment. Indexing
      // into `points` directly would land on a vertex — and for a straight
      // two-point edge that vertex is the arrowhead, dropping the label on top
      // of the target node. The label is then nudged off the line itself:
      // below a horizontal run, to the right of a vertical one.
      let best = 0;
      let bestLength = -1;
      for (let i = 0; i < points.length - 1; i += 1) {
        const length =
          Math.abs(points[i + 1].x - points[i].x) +
          Math.abs(points[i + 1].y - points[i].y);
        if (length > bestLength) {
          bestLength = length;
          best = i;
        }
      }
      const from = points[best];
      const to = points[best + 1];
      const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
      const lx = (from.x + to.x) / 2 + (horizontal ? 0 : 12);
      const ly = (from.y + to.y) / 2 + (horizontal ? -13 : 0);

      const text = labelMarkup(edge.label, lx, ly, 140, 11, "#4b5563");
      if (text) {
        const approx = Math.max(edge.label.length * 6.4, 18);
        edgeMarkup.push(
          `<rect x="${round(lx - approx / 2 - 3)}" y="${round(ly - 8)}" width="${round(approx + 6)}" height="16" fill="#ffffff" opacity="0.85" rx="3" />`,
          text,
        );
      }
    }
  }

  const nodeMarkup = nodes.map((node) => {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    let shape: string;
    if (node.kind === "ellipse") {
      shape = `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(node.width / 2)}" ry="${round(node.height / 2)}" fill="${node.fill}" stroke="${node.stroke}" stroke-width="1.5" />`;
    } else if (node.kind === "rhombus") {
      const pts = [
        `${round(cx)},${round(node.y)}`,
        `${round(node.x + node.width)},${round(cy)}`,
        `${round(cx)},${round(node.y + node.height)}`,
        `${round(node.x)},${round(cy)}`,
      ].join(" ");
      shape = `<polygon points="${pts}" fill="${node.fill}" stroke="${node.stroke}" stroke-width="1.5" />`;
    } else {
      shape = `<rect x="${round(node.x)}" y="${round(node.y)}" width="${round(node.width)}" height="${round(node.height)}" rx="${node.rounded ? 8 : 0}" fill="${node.fill}" stroke="${node.stroke}" stroke-width="1.5" />`;
    }
    const text = labelMarkup(
      node.label,
      cx,
      cy,
      node.kind === "rhombus" ? node.width * 0.72 : node.width,
      node.fontSize,
      node.fontColor,
    );
    return `<g>${shape}${text}</g>`;
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  const x = round(minX - PADDING);
  const y = round(minY - PADDING);
  const width = round(maxX - minX + PADDING * 2);
  const height = round(maxY - minY + PADDING * 2);

  // The viewBox carries the real dimensions; `max-width` keeps a wide diagram
  // inside the chat column while `height:auto` preserves its aspect ratio.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}" style="max-width:100%;height:auto;display:block;margin:0 auto" preserveAspectRatio="xMidYMid meet" role="img">`,
    ...edgeMarkup,
    ...nodeMarkup,
    `</svg>`,
  ].join("");
}
