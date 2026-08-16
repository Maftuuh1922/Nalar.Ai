import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  normalizeDrawioXml,
  looksLikeDrawioXml,
  parseDrawioXml,
  drawioXmlToSvg,
} from "../lib/drawio";

const MINIMAL = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Login" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="320" y="200" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;

const BASIC = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="Mulai" style="ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="340" y="40" width="120" height="40" as="geometry"/></mxCell><mxCell id="b" value="Login" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1"><mxGeometry x="300" y="140" width="160" height="60" as="geometry"/></mxCell><mxCell id="c" value="Berhasil?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1"><mxGeometry x="310" y="260" width="140" height="80" as="geometry"/></mxCell><mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;" edge="1" parent="1" source="a" target="b"/><mxCell id="e2" value="Ya" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" parent="1" source="c" target="b"/></root></mxGraphModel></diagram></mxfile>`;

test("looksLikeDrawioXml: true for plain mxfile", () => {
  assert.ok(looksLikeDrawioXml(MINIMAL));
});

test("looksLikeDrawioXml: true for backtick-wrapped lines", () => {
  const wrapped = MINIMAL.split("\n")
    .map((l) => (l.trim() ? "`" + l.trim() + "`" : l))
    .join("\n");
  assert.ok(looksLikeDrawioXml(wrapped));
});

test("looksLikeDrawioXml: true for HTML-escaped XML", () => {
  assert.ok(looksLikeDrawioXml(MINIMAL.replace(/</g, "&lt;").replace(/>/g, "&gt;")));
});

test("looksLikeDrawioXml: false for non-drawio content", () => {
  assert.equal(looksLikeDrawioXml("flowchart TD\nA-->B"), false);
  assert.equal(looksLikeDrawioXml("just some prose"), false);
});

test("normalizeDrawioXml: strips fences, language lines, and backticks", () => {
  const wrapped = MINIMAL.split("\n")
    .map((l) => (l.trim() ? "`" + l.trim() + "`" : l))
    .join("\n");
  const withJunk = `\`\`\`drawio\n${wrapped}\n\`\`\``;
  assert.ok(normalizeDrawioXml(withJunk).startsWith("<mxfile"));
});

test("parseDrawioXml: parses minimal diagram with one node", () => {
  const d = parseDrawioXml(MINIMAL);
  assert.equal(d.nodes.length, 1);
  assert.equal(d.nodes[0].label, "Login");
  assert.equal(d.nodes[0].kind, "rect");
  assert.equal(d.nodes[0].rounded, true);
  assert.equal(d.nodes[0].x, 320);
});

test("parseDrawioXml: shape kinds from style", () => {
  const d = parseDrawioXml(BASIC);
  const byLabel = new Map(d.nodes.map((n) => [n.label, n]));
  assert.equal(byLabel.get("Mulai")?.kind, "ellipse");
  assert.equal(byLabel.get("Login")?.kind, "rect");
  assert.equal(byLabel.get("Berhasil?")?.kind, "rhombus");
  assert.equal(byLabel.get("Mulai")?.fill, "#dae8fc");
  assert.equal(d.edges.length, 2);
  assert.equal(d.edges[0].source, "a");
  assert.equal(d.edges[0].target, "b");
  assert.equal(d.edges[1].label, "Ya");
});

test("parseDrawioXml: decodes entities in labels and strip HTML", () => {
  const withAmp = MINIMAL.replace('value="Login"', 'value="Input username &amp; password"');
  const d = parseDrawioXml(withAmp);
  assert.equal(d.nodes[0].label, "Input username & password");
});

test("parseDrawioXml: ignores edges to unknown nodes and zero-size cells", () => {
  const weird = MINIMAL.replace(
    "</mxGraphModel>",
    `<mxCell id="orphan" value="x" style="rounded=1" vertex="1" parent="1"><mxGeometry x="0" y="0" width="0" height="0" as="geometry"/></mxCell><mxCell id="e" style="edgeStyle=orthogonalEdgeStyle" edge="1" parent="1" source="2" target="nope"/></mxGraphModel>`,
  );
  const d = parseDrawioXml(weird);
  assert.equal(d.nodes.length, 1);
  assert.equal(d.edges.length, 0);
});

test("drawioXmlToSvg: produces well-formed SVG with shapes", () => {
  const svg = drawioXmlToSvg(BASIC);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes('<ellipse'));
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.includes('<polygon'));
  assert.ok(svg.includes("<path"));
  assert.ok(svg.includes("Mulai"));
  assert.ok(svg.includes('stroke="#6c8ebf"'));
  assert.ok(isBalanced(svg));
});

/**
 * Minimal well-formedness check: every open tag is closed in order. The
 * renderer must stay DOM-free (it runs during SSR and in this runner), so
 * DOMParser is deliberately not used here.
 */
function isBalanced(markup: string): boolean {
  const stack: string[] = [];
  const tag = /<(\/?)([a-zA-Z][\w:-]*)\b[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(markup)) !== null) {
    const [, closing, name, selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

test("drawioXmlToSvg: empty string when nothing drawable", () => {
  assert.equal(drawioXmlToSvg("flowchart TD"), "");
  assert.equal(drawioXmlToSvg(""), "");
});

test("drawioXmlToSvg: XSS payloads stay inert", () => {
  const evilLabel =
    '<mxfile><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="&lt;img src=x onerror=alert(1)&gt;" style="rounded=1" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel></mxfile>';
  const svg = drawioXmlToSvg(evilLabel);
  assert.ok(!svg.includes("<script"));
  assert.ok(!svg.includes("onerror="));
  assert.ok(!svg.includes("javascript:"));
});

test("drawioXmlToSvg: NaN/Infinity never reach the SVG", () => {
  const evilGeo = MINIMAL.replace('x="320"', 'x="javascript:alert(1)"');
  const svg = drawioXmlToSvg(evilGeo);
  assert.ok(!svg.includes("NaN"));
  assert.ok(!svg.includes("Infinity"));
  assert.ok(!svg.includes("javascript:"));
});
