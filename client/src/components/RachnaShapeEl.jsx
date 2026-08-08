// ============================================================
// RachnaShapeEl.jsx — shared shape renderer for Rachna
// Extracted verbatim from TriangleRachnaGame.jsx so the admin
// Elements editor's live preview renders shapes identically to
// the live game (single source of truth for shape SVG markup).
// ============================================================

import React from 'react';

export const SHAPE_SIZE_PX = { large: 200, small: 99 };
export const SOURCE_SIZE_PX = { large: 56, small: 38 };

// ─── Shape renderer (both source and workspace) ───────────────
const TEXTURE_DEFS = (
  <defs>
    <filter id="rg-fabric-texture" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.55 0.45" numOctaves="4" seed="8" result="noise" />
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
      <feComponentTransfer in="grayNoise" result="lightenedNoise">
        <feFuncR type="linear" slope="0.35" intercept="0.65" />
        <feFuncG type="linear" slope="0.35" intercept="0.65" />
        <feFuncB type="linear" slope="0.35" intercept="0.65" />
      </feComponentTransfer>
      <feBlend in="SourceGraphic" in2="lightenedNoise" mode="multiply" result="textured" />
      <feComposite in="textured" in2="SourceGraphic" operator="in" />
    </filter>
  </defs>
);

export function ShapeEl({ shape, color, size, orientation, workspace = false, customSize, textured = false }) {
  const sizePx = customSize || (workspace ? SHAPE_SIZE_PX[size] : SOURCE_SIZE_PX[size]);
  const dropShadow = workspace ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : 'none';
  const shapeFilter = textured ? 'url(#rg-fabric-texture)' : undefined;

  if (shape === 'circle') {
    return (
      <svg width={sizePx} height={sizePx} viewBox="0 0 100 100" style={{ filter: dropShadow }}>
        {textured && TEXTURE_DEFS}
        <circle cx="50" cy="50" r="50" fill={color} filter={shapeFilter} />
      </svg>
    );
  }
  if (shape === 'square') {
    return (
      <svg width={sizePx} height={sizePx} viewBox="0 0 100 100" style={{ filter: dropShadow }}>
        {textured && TEXTURE_DEFS}
        <rect width="100" height="100" fill={color} filter={shapeFilter} />
      </svg>
    );
  }
  if (shape === 'diamond') {
    return (
      <svg width={sizePx} height={sizePx} viewBox="0 0 100 100" style={{ filter: dropShadow, overflow: 'visible' }}>
        {textured && TEXTURE_DEFS}
        <polygon points="50,-10.1 110.1,50 50,110.1 -10.1,50" fill={color} filter={shapeFilter} />
      </svg>
    );
  }
  if (shape === 'triangle-up') {
    return (
      <svg width={sizePx} height={sizePx} viewBox="0 0 100 100" style={{ filter: dropShadow }}>
        {textured && TEXTURE_DEFS}
        <polygon points="50,25 0,75 100,75" fill={color} filter={shapeFilter} />
      </svg>
    );
  }
  if (shape === 'triangle-down') {
    return (
      <svg width={sizePx} height={sizePx} viewBox="0 0 100 100" style={{ filter: dropShadow }}>
        {textured && TEXTURE_DEFS}
        <polygon points="0,25 100,25 50,75" fill={color} filter={shapeFilter} />
      </svg>
    );
  }
  if (shape === 'right-triangle') {
    const o = orientation || 'BL';
    let pts = "0,0 0,100 100,100"; // BL
    if (o === 'BR') pts = "100,0 0,100 100,100";
    if (o === 'UL') pts = "0,0 0,100 100,0";
    if (o === 'UR') pts = "0,0 100,0 100,100";
    return (
      <svg width={sizePx} height={sizePx} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ filter: dropShadow }}>
        {textured && TEXTURE_DEFS}
        <polygon points={pts} fill={color} filter={shapeFilter} />
      </svg>
    );
  }
  return null;
}
