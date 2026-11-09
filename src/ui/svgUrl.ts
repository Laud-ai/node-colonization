/**
 * 0.15.2 — SVG string → data URL for <img>/canvas use. Adds xmlns only when missing:
 * a duplicate xmlns attribute is an XML error, and Firefox (strict SVG-as-image parser)
 * then fails to load the image — the 0.15.0/0.15.1 route-label flag bug.
 */
export function svgDataUrl(svg: string): string {
  const open = svg.slice(0, svg.indexOf(">") + 1);
  const fixed = /\sxmlns="/.test(open) ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(fixed);
}
