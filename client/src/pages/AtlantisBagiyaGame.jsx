import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage, STT_LANG_MAP } from '../contexts/LanguageContext';
import { useHeaderConfig } from '../contexts/HeaderConfigContext';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import './AtlantisBagiyaGame.css';

// ─── Constants ───────────────────────────────────────────
const GAME_NAME = 'atlantis_bagiya';
const TOTAL_MAX_SUB_QUESTIONS = 54; // 1+2+2+3+3+4+5+4+5+7+6+6+6

const IMG = '/assets/images/bagiya';
const AUD = '/assets/audios/bagiya';

// ─── Item Catalogue ───────────────────────────────────────
const ITEMS = [
  { id: 1,  stem: 'bird_ba',         name: 'BA',        category: 'bird',   img: `${IMG}/bird_ba.png`,         audio: `${AUD}/bird_ba.wav`,         khaHai: `${AUD}/bird_ba_kha_hai.wav` },
  { id: 2,  stem: 'bird_2',          name: 'Bird 2',    category: 'bird',   img: `${IMG}/bird_2.png`,          audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 3,  stem: 'bird_deem',       name: 'DEEM',      category: 'bird',   img: `${IMG}/bird_deem.png`,       audio: `${AUD}/bird_deem.wav`,       khaHai: `${AUD}/bird_deem_kha_hai.wav` },
  { id: 4,  stem: 'bird_4',          name: 'Bird 4',    category: 'bird',   img: `${IMG}/bird_4.png`,          audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 5,  stem: 'bird_5',          name: 'Bird 5',    category: 'bird',   img: `${IMG}/bird_5.png`,          audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 6,  stem: 'bird_jul',        name: 'JUL',       category: 'bird',   img: `${IMG}/bird_jul.png`,        audio: `${AUD}/bird_jul.wav`,        khaHai: `${AUD}/bird_jul_kha_hai.wav` },
  { id: 7,  stem: 'bird_hoop',       name: 'HOOP',      category: 'bird',   img: `${IMG}/bird_hoop.png`,       audio: `${AUD}/bird_hoop.wav`,       khaHai: `${AUD}/bird_hoop_kha_hai.wav` },
  { id: 8,  stem: 'insect_ghesa',    name: 'GHESA',     category: 'insect', img: `${IMG}/insect_ghesa.png`,    audio: `${AUD}/insect_ghesa.wav`,    khaHai: `${AUD}/insect_ghesa_kha_hai.wav` },
  { id: 9,  stem: 'insect_mogju',    name: 'MOGJU',     category: 'insect', img: `${IMG}/insect_mogju.png`,    audio: `${AUD}/insect_mogju.wav`,    khaHai: `${AUD}/insect_mogju_kha_hai.wav` },
  { id: 10, stem: 'insect_baigul',   name: 'BAIGUL',    category: 'insect', img: `${IMG}/insect_baigul.png`,   audio: `${AUD}/insect_baigul.wav`,   khaHai: `${AUD}/insect_baigul_kha_hai.wav` },
  { id: 11, stem: 'insect_4',        name: 'Insect 4',  category: 'insect', img: `${IMG}/insect_4.png`,        audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 12, stem: 'insect_thooli',   name: 'THOOLI',    category: 'insect', img: `${IMG}/insect_thooli.png`,   audio: `${AUD}/insect_thooli.wav`,   khaHai: `${AUD}/insect_thooli_kha_hai.wav` },
  { id: 13, stem: 'flower_shibagu',  name: 'SHIBAGU',   category: 'flower', img: `${IMG}/flower_shibagu.png`,  audio: `${AUD}/flower_shibagu.wav`,  khaHai: `${AUD}/flower_shibagu_kha_hai.wav` },
  { id: 14, stem: 'flower_mulpaki',  name: 'MULPAKI',   category: 'flower', img: `${IMG}/flower_mulpaki.png`,  audio: `${AUD}/flower_mulpaki.wav`,  khaHai: `${AUD}/flower_mulpaki_kha_hai.wav` },
  { id: 15, stem: 'flower_dhulkoma', name: 'DHULKOMA',  category: 'flower', img: `${IMG}/flower_dhulkoma.png`, audio: `${AUD}/flower_dhulkoma.wav`, khaHai: `${AUD}/flower_dhulkoma_kha_hai.wav` },
  { id: 16, stem: 'flower_4',        name: 'Flower 4',  category: 'flower', img: `${IMG}/flower_4.png`,        audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 17, stem: 'flower_pegeto',   name: 'PEGETO',    category: 'flower', img: `${IMG}/flower_pegeto.png`,   audio: `${AUD}/flower_pegeto.wav`,   khaHai: `${AUD}/flower_pegeto_kha_hai.wav` },
];

const itemByStem = Object.fromEntries(ITEMS.map(i => [i.stem, i]));

// ─── Main-game Screen Configurations ─────────────────────
// Each screen: introduce one creature (question), then ask about multiple (response).
// subQStems: order in which the examiner asks "Where is X?"
// fixedResponseStems: hard-coded grid; requiredStems + responseCount: randomly generated.
// checkpoint: after this response screen, if totalScore <= threshold, stop game.
const SCREEN_CONFIGS = [
  {
    num: 1,
    questionStem: 'bird_ba',
    fixedResponseStems: ['bird_ba','bird_2','bird_deem','bird_4','bird_5','insect_thooli','flower_pegeto'],
    subQStems: ['bird_ba'],
    checkpoint: null,
  },
  {
    num: 2,
    questionStem: 'bird_jul',
    fixedResponseStems: ['bird_ba','bird_2','bird_4','bird_5','bird_jul','insect_baigul','flower_shibagu'],
    subQStems: ['bird_jul','bird_ba'],
    checkpoint: null,
  },
  {
    num: 3,
    questionStem: 'bird_deem',
    fixedResponseStems: ['bird_ba','bird_2','bird_deem','bird_4','bird_jul','insect_baigul','flower_mulpaki'],
    subQStems: ['bird_jul','bird_deem'],
    checkpoint: null,
  },
  {
    num: 4,
    questionStem: 'bird_hoop',
    requiredStems: ['bird_deem','bird_hoop','bird_ba'],
    responseCount: 8,
    subQStems: ['bird_deem','bird_hoop','bird_ba'],
    checkpoint: null,
  },
  {
    num: 5,
    questionStem: 'insect_ghesa',
    requiredStems: ['bird_jul','insect_ghesa','bird_hoop'],
    responseCount: 9,
    subQStems: ['bird_jul','insect_ghesa','bird_hoop'],
    checkpoint: { threshold: 15 },
  },
  {
    num: 6,
    questionStem: 'insect_thooli',
    requiredStems: ['bird_deem','insect_ghesa','insect_thooli','bird_ba'],
    responseCount: 9,
    subQStems: ['bird_deem','insect_ghesa','insect_thooli','bird_ba'],
    checkpoint: null,
  },
  {
    num: 7,
    questionStem: 'insect_baigul',
    requiredStems: ['bird_ba','insect_thooli','bird_jul','insect_baigul','bird_hoop'],
    responseCount: 10,
    subQStems: ['bird_ba','insect_thooli','bird_jul','insect_baigul','bird_hoop'],
    checkpoint: { threshold: 24 },
  },
  {
    num: 8,
    questionStem: 'insect_mogju',
    requiredStems: ['bird_hoop','insect_mogju','bird_ba','insect_baigul'],
    responseCount: 9,
    subQStems: ['bird_hoop','insect_mogju','bird_ba','insect_baigul'],
    checkpoint: null,
  },
  {
    num: 9,
    questionStem: 'flower_shibagu',
    requiredStems: ['bird_deem','insect_ghesa','flower_shibagu','bird_hoop','insect_mogju'],
    responseCount: 12,
    subQStems: ['bird_deem','insect_ghesa','flower_shibagu','bird_hoop','insect_mogju'],
    checkpoint: { threshold: 38 },
  },
  {
    num: 10,
    questionStem: 'flower_mulpaki',
    requiredStems: ['bird_ba','insect_thooli','flower_shibagu','bird_jul','insect_ghesa','flower_mulpaki','bird_4'],
    responseCount: 11,
    subQStems: ['bird_ba','insect_thooli','flower_shibagu','bird_jul','insect_ghesa','flower_mulpaki','bird_4'],
    checkpoint: null,
  },
  {
    num: 11,
    questionStem: 'flower_pegeto',
    requiredStems: ['bird_deem','flower_pegeto','bird_jul','flower_mulpaki','insect_baigul','bird_5'],
    responseCount: 11,
    subQStems: ['bird_deem','flower_pegeto','bird_jul','flower_mulpaki','insect_baigul','bird_5'],
    checkpoint: { threshold: 63 },
  },
  {
    num: 12,
    questionStem: 'flower_dhulkoma',
    requiredStems: ['insect_thooli', 'flower_pegeto', 'bird_ba', 'flower_dhulkoma', 'insect_mogju', 'flower_4'],
    responseCount: 12,
    subQStems: ['insect_thooli', 'flower_pegeto', 'bird_ba', 'flower_dhulkoma', 'insect_mogju', 'flower_4'],
    checkpoint: null,
  },
  {
    num: 13,
    questionStem: 'flower_dhulkoma',
    requiredStems: ['insect_ghesa', 'insect_baigul', 'flower_dhulkoma', 'bird_hoop', 'flower_shibagu', 'insect_4'],
    responseCount: 13,
    subQStems: ['insect_ghesa', 'insect_baigul', 'flower_dhulkoma', 'bird_hoop', 'flower_shibagu', 'insect_4'],
    checkpoint: null,
  },
];

// ─── Practice pool (items with named audio) ───────────────
const PRACTICE_POOL = ITEMS.filter(i => i.audio !== null);

// ─── Helpers ──────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Scatter layout (no rows/columns, no overlap, any item count) ─────────────
// Always (at most) 3 rows. Deterministic seeded PRNG (mulberry32) — same seed
// always produces the same layout, so a given sub-question's positions never
// shift on re-render, but a different seed (new sub-question) produces a
// fresh arrangement.
const SCATTER_ROWS = 3;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Balance `count` items across 3 rows first (every row gets its fair share,
// so the scatter spans the full height). Columns use ONE global count, sized
// to the busiest row (not a column count sized for the densest screen in the
// game, and not each row's own count either) — every row shares the exact
// same column pitch, which is what keeps the gap between elements equal
// everywhere. A row with fewer items than that column count picks a RANDOM
// subset of those columns (instead of always splitting its own width into
// just `need` fixed halves/thirds) — that's the difference between a sparse
// row always leaving the same dead zone (e.g. 2 items in a row of 3 columns
// always landing in columns 0 and 2, permanently skipping the middle) and
// one that sometimes uses the middle column, which is what actually reads as
// scattered rather than two clusters with a gap between them.
function computeScatterPositions(count, containerWidth, containerHeight, seed) {
  if (!count || containerWidth <= 0 || containerHeight <= 0) return [];
  const rng = mulberry32(seed);

  const itemsPerRow = Array(SCATTER_ROWS).fill(Math.floor(count / SCATTER_ROWS));
  const remainder = count - itemsPerRow.reduce((a, b) => a + b, 0);
  const rowOrder = Array.from({ length: SCATTER_ROWS }, (_, i) => i);
  for (let i = rowOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rowOrder[i], rowOrder[j]] = [rowOrder[j], rowOrder[i]];
  }
  for (let k = 0; k < remainder; k++) itemsPerRow[rowOrder[k]]++;

  const colCount = Math.max(...itemsPerRow);
  const rowPitch = containerHeight / SCATTER_ROWS;
  const colPitch = containerWidth / colCount;
  // Sized smaller than the pitch on purpose — the leftover margin is what the
  // jitter below uses to nudge items off their row/column centre (including
  // toward the boundary with the next row), which is what makes some items
  // land visibly between rows instead of snapped to 3 rigid lines.
  const itemSize = Math.max(70, Math.min(320, Math.min(rowPitch, colPitch) * 0.86));
  const maxJitterX = Math.max(0, (colPitch - itemSize) / 2);
  const maxJitterY = Math.max(0, (rowPitch - itemSize) / 2);

  const positions = [];
  for (let r = 0; r < SCATTER_ROWS; r++) {
    const need = itemsPerRow[r];
    if (!need) continue;
    const top = r * rowPitch + (rowPitch - itemSize) / 2;
    const colIndices = Array.from({ length: colCount }, (_, c) => c);
    for (let i = colIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [colIndices[i], colIndices[j]] = [colIndices[j], colIndices[i]];
    }
    for (let k = 0; k < need; k++) {
      const col = colIndices[k];
      const jitterX = (rng() * 2 - 1) * maxJitterX;
      const jitterY = (rng() * 2 - 1) * maxJitterY;
      const left = col * colPitch + (colPitch - itemSize) / 2 + jitterX;
      positions.push({ left, top: top + jitterY, size: itemSize });
    }
  }
  return positions;
}

// ─── Fixed response layouts ────────────────────────────────────────────────
// Per request: each main-game response screen (1-13) now uses a FIXED set of
// item positions instead of the randomised scatter above — the same slots,
// in the same place, every time. Each entry is one verified-good arrangement
// (no overlap, full edge-to-edge coverage, equal spacing) frozen from
// computeScatterPositions, expressed as % of the container's width/height
// (not raw px) so it stays correct if the actual device's response-grid area
// differs slightly from the 1180x650 (11" iPad landscape) reference used to
// generate these. `sizePct` is a % of the container WIDTH (items are square).
const FIXED_RESPONSE_LAYOUTS = {
  1: [
    { leftPct: 3.85, topPct: 1.93, sizePct: 15.79 },
    { leftPct: 61.78, topPct: 1.61, sizePct: 15.79 },
    { leftPct: 79.95, topPct: 3.27, sizePct: 15.79 },
    { leftPct: 81.67, topPct: 35.67, sizePct: 15.79 },
    { leftPct: 19.26, topPct: 35.36, sizePct: 15.79 },
    { leftPct: 7.70, topPct: 70.41, sizePct: 15.79 },
    { leftPct: 71.20, topPct: 68.33, sizePct: 15.79 },
  ],
  2: [
    { leftPct: 1.32, topPct: 1.53, sizePct: 15.79 },
    { leftPct: 69.81, topPct: 1.94, sizePct: 15.79 },
    { leftPct: 34.50, topPct: 35.13, sizePct: 15.79 },
    { leftPct: 79.71, topPct: 37.01, sizePct: 15.79 },
    { leftPct: 5.71, topPct: 35.40, sizePct: 15.79 },
    { leftPct: 72.75, topPct: 69.68, sizePct: 15.79 },
    { leftPct: 7.26, topPct: 70.73, sizePct: 15.79 },
  ],
  3: [
    { leftPct: 45.94, topPct: 3.42, sizePct: 15.79 },
    { leftPct: 74.90, topPct: 2.11, sizePct: 15.79 },
    { leftPct: 73.17, topPct: 33.88, sizePct: 15.79 },
    { leftPct: 1.41, topPct: 36.76, sizePct: 15.79 },
    { leftPct: 34.19, topPct: 35.10, sizePct: 15.79 },
    { leftPct: 78.97, topPct: 70.99, sizePct: 15.79 },
    { leftPct: 35.45, topPct: 69.15, sizePct: 15.79 },
  ],
  4: [
    { leftPct: 66.87, topPct: 3.08, sizePct: 15.79 },
    { leftPct: 35.60, topPct: 1.38, sizePct: 15.79 },
    { leftPct: 68.74, topPct: 34.13, sizePct: 15.79 },
    { leftPct: 6.63, topPct: 34.78, sizePct: 15.79 },
    { leftPct: 46.36, topPct: 35.30, sizePct: 15.79 },
    { leftPct: 81.07, topPct: 68.76, sizePct: 15.79 },
    { leftPct: 5.68, topPct: 70.70, sizePct: 15.79 },
    { leftPct: 46.73, topPct: 70.31, sizePct: 15.79 },
  ],
  5: [
    { leftPct: 9.42, topPct: 0.66, sizePct: 15.79 },
    { leftPct: 71.99, topPct: 1.05, sizePct: 15.79 },
    { leftPct: 43.62, topPct: 4.01, sizePct: 15.79 },
    { leftPct: 8.83, topPct: 36.92, sizePct: 15.79 },
    { leftPct: 68.04, topPct: 35.11, sizePct: 15.79 },
    { leftPct: 46.85, topPct: 36.74, sizePct: 15.79 },
    { leftPct: 81.28, topPct: 71.14, sizePct: 15.79 },
    { leftPct: 6.50, topPct: 67.88, sizePct: 15.79 },
    { leftPct: 39.00, topPct: 68.27, sizePct: 15.79 },
  ],
  6: [
    { leftPct: 45.81, topPct: 0.14, sizePct: 15.79 },
    { leftPct: 11.76, topPct: 3.41, sizePct: 15.79 },
    { leftPct: 67.99, topPct: 0.37, sizePct: 15.79 },
    { leftPct: 83.52, topPct: 33.37, sizePct: 15.79 },
    { leftPct: 3.74, topPct: 35.93, sizePct: 15.79 },
    { leftPct: 39.77, topPct: 36.90, sizePct: 15.79 },
    { leftPct: 45.80, topPct: 68.82, sizePct: 15.79 },
    { leftPct: 15.00, topPct: 68.81, sizePct: 15.79 },
    { leftPct: 67.50, topPct: 69.48, sizePct: 15.79 },
  ],
  7: [
    { leftPct: 9.20, topPct: 0.55, sizePct: 15.79 },
    { leftPct: 78.32, topPct: 1.23, sizePct: 15.79 },
    { leftPct: 28.75, topPct: 1.58, sizePct: 15.79 },
    { leftPct: 54.22, topPct: 1.75, sizePct: 15.79 },
    { leftPct: 2.32, topPct: 34.92, sizePct: 15.79 },
    { leftPct: 76.48, topPct: 36.41, sizePct: 15.79 },
    { leftPct: 25.36, topPct: 36.24, sizePct: 15.79 },
    { leftPct: 58.00, topPct: 69.04, sizePct: 15.79 },
    { leftPct: 27.83, topPct: 68.99, sizePct: 15.79 },
    { leftPct: 6.15, topPct: 69.56, sizePct: 15.79 },
  ],
  8: [
    { leftPct: 33.69, topPct: 3.78, sizePct: 15.79 },
    { leftPct: 15.90, topPct: 3.26, sizePct: 15.79 },
    { leftPct: 78.00, topPct: 0.98, sizePct: 15.79 },
    { leftPct: 68.47, topPct: 37.77, sizePct: 15.79 },
    { leftPct: 16.05, topPct: 36.43, sizePct: 15.79 },
    { leftPct: 38.64, topPct: 36.42, sizePct: 15.79 },
    { leftPct: 68.92, topPct: 68.74, sizePct: 15.79 },
    { leftPct: 47.65, topPct: 68.37, sizePct: 15.79 },
    { leftPct: 4.78, topPct: 70.03, sizePct: 15.79 },
  ],
  9: [
    { leftPct: 30.64, topPct: 1.52, sizePct: 15.79 },
    { leftPct: 50.31, topPct: 2.88, sizePct: 15.79 },
    { leftPct: 3.58, topPct: 1.99, sizePct: 15.79 },
    { leftPct: 83.88, topPct: 2.95, sizePct: 15.79 },
    { leftPct: 33.33, topPct: 33.41, sizePct: 15.79 },
    { leftPct: 5.79, topPct: 35.48, sizePct: 15.79 },
    { leftPct: 54.46, topPct: 33.47, sizePct: 15.79 },
    { leftPct: 81.86, topPct: 35.10, sizePct: 15.79 },
    { leftPct: 53.54, topPct: 69.47, sizePct: 15.79 },
    { leftPct: 30.15, topPct: 70.30, sizePct: 15.79 },
    { leftPct: 79.42, topPct: 70.60, sizePct: 15.79 },
    { leftPct: 5.61, topPct: 69.32, sizePct: 15.79 },
  ],
  10: [
    { leftPct: 52.81, topPct: 1.07, sizePct: 15.79 },
    { leftPct: 6.01, topPct: 2.77, sizePct: 15.79 },
    { leftPct: 80.15, topPct: 0.48, sizePct: 15.79 },
    { leftPct: 32.81, topPct: 0.11, sizePct: 15.79 },
    { leftPct: 53.24, topPct: 37.24, sizePct: 15.79 },
    { leftPct: 77.64, topPct: 34.17, sizePct: 15.79 },
    { leftPct: 29.36, topPct: 35.79, sizePct: 15.79 },
    { leftPct: 26.54, topPct: 67.80, sizePct: 15.79 },
    { leftPct: 5.25, topPct: 68.72, sizePct: 15.79 },
    { leftPct: 58.17, topPct: 67.13, sizePct: 15.79 },
    { leftPct: 83.14, topPct: 69.24, sizePct: 15.79 },
  ],
  11: [
    { leftPct: 52.81, topPct: 1.42, sizePct: 15.79 },
    { leftPct: 5.96, topPct: 2.64, sizePct: 15.79 },
    { leftPct: 78.24, topPct: 2.18, sizePct: 15.79 },
    { leftPct: 84.01, topPct: 36.84, sizePct: 15.79 },
    { leftPct: 28.73, topPct: 36.85, sizePct: 15.79 },
    { leftPct: 57.72, topPct: 37.56, sizePct: 15.79 },
    { leftPct: 4.01, topPct: 34.56, sizePct: 15.79 },
    { leftPct: 7.15, topPct: 66.86, sizePct: 15.79 },
    { leftPct: 26.97, topPct: 67.98, sizePct: 15.79 },
    { leftPct: 77.66, topPct: 67.29, sizePct: 15.79 },
    { leftPct: 55.72, topPct: 66.95, sizePct: 15.79 },
  ],
  12: [
    { leftPct: 7.20, topPct: 1.38, sizePct: 15.79 },
    { leftPct: 55.97, topPct: 2.07, sizePct: 15.79 },
    { leftPct: 28.20, topPct: 1.77, sizePct: 15.79 },
    { leftPct: 80.20, topPct: 3.03, sizePct: 15.79 },
    { leftPct: 4.43, topPct: 34.05, sizePct: 15.79 },
    { leftPct: 29.47, topPct: 34.26, sizePct: 15.79 },
    { leftPct: 75.97, topPct: 37.75, sizePct: 15.79 },
    { leftPct: 51.22, topPct: 34.95, sizePct: 15.79 },
    { leftPct: 8.34, topPct: 70.63, sizePct: 15.79 },
    { leftPct: 52.51, topPct: 69.68, sizePct: 15.79 },
    { leftPct: 25.05, topPct: 70.23, sizePct: 15.79 },
    { leftPct: 78.41, topPct: 68.48, sizePct: 15.79 },
  ],
  13: [
    { leftPct: 40.76, topPct: 0.47, sizePct: 15.79 },
    { leftPct: 0.11, topPct: 0.96, sizePct: 15.79 },
    { leftPct: 82.40, topPct: 0.44, sizePct: 15.79 },
    { leftPct: 20.61, topPct: 0.70, sizePct: 15.79 },
    { leftPct: 81.06, topPct: 36.68, sizePct: 15.79 },
    { leftPct: 60.08, topPct: 37.03, sizePct: 15.79 },
    { leftPct: 2.92, topPct: 37.74, sizePct: 15.79 },
    { leftPct: 23.34, topPct: 37.41, sizePct: 15.79 },
    { leftPct: 2.60, topPct: 67.26, sizePct: 15.79 },
    { leftPct: 62.10, topPct: 71.15, sizePct: 15.79 },
    { leftPct: 82.40, topPct: 68.04, sizePct: 15.79 },
    { leftPct: 23.57, topPct: 67.57, sizePct: 15.79 },
    { leftPct: 42.37, topPct: 71.27, sizePct: 15.79 },
  ],
};

function getFixedPositions(layoutsSource, screenNum, containerWidth, containerHeight) {
  const layout = layoutsSource[screenNum] || layoutsSource[String(screenNum)];
  if (!layout || containerWidth <= 0 || containerHeight <= 0) return [];
  return layout.map(({ leftPct, topPct, sizePct }) => ({
    left: (leftPct / 100) * containerWidth,
    top: (topPct / 100) * containerHeight,
    size: (sizePct / 100) * containerWidth,
  }));
}

// Same measurement plumbing as useScatterLayout below, but looks up a fixed
// per-screen layout instead of computing a random one. `layoutsSource`
// defaults to the bundled FIXED_RESPONSE_LAYOUTS but the caller passes the
// admin-editable, server-fetched layouts when available — see the
// `elementPositionLayouts` fetch in the main component, which falls back to
// this same constant if the request fails.
function useFixedScatterLayout(screenNum, layoutsSource = FIXED_RESPONSE_LAYOUTS) {
  const [node, setNode] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!node) return;
    const update = () => setSize({ width: node.offsetWidth, height: node.offsetHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  const positions = getFixedPositions(layoutsSource, screenNum, size.width, size.height);
  return { containerRef: setNode, positions };
}

// Measures a container element and returns deterministic, non-overlapping
// (left, top, size) positions for `count` items — recomputed only when the
// container resizes or `seed` changes (e.g. a new sub-question). Still used
// for the practice screen, which isn't part of the fixed-layout request.
function useScatterLayout(count, seed) {
  // A plain useRef's .current changing (e.g. when this screen mounts after the
  // user navigates to it) does NOT re-run effects, so a `useRef` here would only
  // ever measure whatever was mounted at the very first render (often null, since
  // this screen isn't shown yet). A callback ref via useState re-fires this
  // effect every time the actual DOM node is attached, including on later
  // navigations to this screen.
  const [node, setNode] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!node) return;
    const update = () => setSize({ width: node.offsetWidth, height: node.offsetHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  const positions = computeScatterPositions(count, size.width, size.height, seed);
  return { containerRef: setNode, positions };
}

function buildResponseSet(cfg) {
  if (cfg.fixedResponseStems) {
    return cfg.fixedResponseStems.map(s => itemByStem[s]).filter(Boolean);
  }
  const required = cfg.requiredStems.map(s => itemByStem[s]).filter(Boolean);
  const reqIds = new Set(required.map(i => i.id));
  
  let availablePool = ITEMS.filter(i => !reqIds.has(i.id));

  if (cfg.num === 10) {
    availablePool = availablePool.filter(item => 
      item.stem !== 'flower_pegeto' && 
      item.stem !== 'flower_dhulkoma' && 
      (item.audio !== null || item.stem === 'bird_4')
    );
  }
  
  if (cfg.num === 11) {
    availablePool = availablePool.filter(item => 
      item.stem !== 'flower_dhulkoma' && 
      (item.audio !== null || item.stem === 'bird_5')
    );
  }
  
  if (cfg.num === 12) {
    availablePool = availablePool.filter(item => 
      item.audio !== null || item.stem === 'flower_4'
    );
  }

  if (cfg.num === 13) {
    availablePool = availablePool.filter(item => 
      item.audio !== null || item.stem === 'insect_4'
    );
  }

  const fillers = shuffle(availablePool).slice(0, cfg.responseCount - required.length);
  return shuffle([...required, ...fillers]);
}

function generateAllResponseSets() {
  const sets = {};
  SCREEN_CONFIGS.forEach(cfg => { sets[cfg.num] = buildResponseSet(cfg); });
  return sets;
}

function scoreAnswer(chosenItem, targetItem) {
  if (!chosenItem) return 0;
  if (chosenItem.id === targetItem.id) return 2;
  if (chosenItem.category === targetItem.category) return 1;
  return 0;
}

const formatTime = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const fmtDuration = (sec) => {
  if (sec == null) return '—';
  const total = Math.round(Number(sec));
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h === 0) return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

// Splash/header art is localized per selected language.
const BAGIYA_IMAGE_BY_LANG = {
  en: `${IMG}/bagiya_english.png`,
  hi: `${IMG}/bagiya_hindi.jpg`,
  mr: `${IMG}/bagiya_marathi.png`,
  te: `${IMG}/bagiya_telugu.png`,
  kn: `${IMG}/bagiya_kannada.png`,
};

// ─── Main Component ───────────────────────────────────────
const AtlantisBagiyaGame = () => {
  // Global Microphone Cleanup: Ensure hardware lock is released on unmount
  useEffect(() => {
    return () => {
      if (window.activeRecognition) {
        window.activeRecognition.onend = null;
        window.activeRecognition.onerror = null;
        try { window.activeRecognition.stop(); } catch(e) {}
        window.activeRecognition = null;
      }
    };
  }, []);

  const { t, language } = useLanguage();
  const bagiyaImage = BAGIYA_IMAGE_BY_LANG[language] || `${IMG}/bagiya.jpg`;
  const { showLogo, showGameIcon, showGameName, showChildId, showTimer, showScore } = useHeaderConfig();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Admin-editable element positions (Admin Panel > Element Positions) ──
  // Falls back to the bundled FIXED_RESPONSE_LAYOUTS on any fetch error or
  // while the request is in flight, so the game never breaks if the server
  // config is briefly unavailable — same defensive pattern as HeaderConfigContext.
  const [elementPositionLayouts, setElementPositionLayouts] = useState(FIXED_RESPONSE_LAYOUTS);
  useEffect(() => {
    axios.get(`${API_URL}/public/element-positions/atlantis_bagiya`)
      .then(({ data }) => {
        if (data && Object.keys(data).length) setElementPositionLayouts(data);
      })
      .catch(() => {}); // keep the bundled defaults on error
  }, []);

  // ── Core session state ──────────────────────────────────
  const [childData, setChildData] = useState(null);
  const [activityData, setActivityData] = useState({ lastPlayed: 'Never', attempts: 0 });
  const [screen, setScreen] = useState('splash'); // splash|practice_q|practice_r|game|score
  const [gameSessionId, setGameSessionId] = useState(null);
  const [attemptNo, setAttemptNo] = useState(1);
  const [allScores, setAllScores] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [qTimer, setQTimer] = useState(0);
  const [pauses, setPauses] = useState([]);

  // ── Main game state ─────────────────────────────────────
  const [mainScreenNum, setMainScreenNum] = useState(1);
  const [mainPhase, setMainPhase] = useState('question'); // question|response
  const [subQIndex, setSubQIndex] = useState(0);         // which subQ is active (0-based)
  const [subQAnswered, setSubQAnswered] = useState({});   // {subQIndex: true}
  const [responseSets, setResponseSets] = useState({});
  const [displayResponseItems, setDisplayResponseItems] = useState([]); // responseSets[mainScreenNum], reshuffled per sub-question for display only
  const [gridFeedback, setGridFeedback] = useState({});  // {itemId: 'correct'|'wrong'}
  const [isRetrying, setIsRetrying] = useState(false);    // Q1 retry sequence in progress (locks grid)
  const isRetryingRef = useRef(false);
  const firstAttemptDoneRef = useRef({});                 // {subQIndex: true} once first attempt has been scored
  const [subQAudioDone, setSubQAudioDone] = useState(false);
  const [questionAudioDone, setQuestionAudioDone] = useState(false);
  const [feedbackAudioPlaying, setFeedbackAudioPlaying] = useState(false);

  // ── Practice state ──────────────────────────────────────
  const [practiceItem, setPracticeItem] = useState(null);
  const [practiceFeedback, setPracticeFeedback] = useState({});
  const [practiceAnswered, setPracticeAnswered] = useState(false);
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [practiceAudioDone, setPracticeAudioDone] = useState(false);
  const [practiceResponseAudioDone, setPracticeResponseAudioDone] = useState(false);
  const [practiceResponseSet, setPracticeResponseSet] = useState([]);

  // ── Modal state ─────────────────────────────────────────
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [audioFinished, setAudioFinished] = useState(false);

  // ── Assessment form ─────────────────────────────────────
  const [assessment, setAssessment] = useState({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  // ── STT ─────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);

  // ── Refs (race-condition safe) ──────────────────────────
  const allScoresRef = useRef([]);
  const gameSessionIdRef = useRef(null);
  const timerSecondsRef = useRef(0);
  const pausesRef = useRef([]);
  const mainScreenNumRef = useRef(1);
  const subQIndexRef = useRef(0);
  const qTimerRef = useRef(0);
  const subQAnsweredRef = useRef({});
  const replayCountsRef = useRef({});   // subQIndex → replay count for current screen
  const itemExposureReplaysRef = useRef({});

  const timerRef = useRef(null);
  const splashAudioRef = useRef(null);
  const activeAudioRef = useRef(null);

  // ── Computed ────────────────────────────────────────────
  const totalScore = allScores.reduce((s, a) => s + a.score, 0);
  const currentConfig = SCREEN_CONFIGS.find(c => c.num === mainScreenNum);

  // ── Sync refs ───────────────────────────────────────────
  useEffect(() => { allScoresRef.current = allScores; }, [allScores]);
  useEffect(() => { gameSessionIdRef.current = gameSessionId; }, [gameSessionId]);
  useEffect(() => { timerSecondsRef.current = timerSeconds; }, [timerSeconds]);
  useEffect(() => { pausesRef.current = pauses; }, [pauses]);
  useEffect(() => { mainScreenNumRef.current = mainScreenNum; }, [mainScreenNum]);
  useEffect(() => { subQIndexRef.current = subQIndex; }, [subQIndex]);
  useEffect(() => { qTimerRef.current = qTimer; }, [qTimer]);
  useEffect(() => { subQAnsweredRef.current = subQAnswered; }, [subQAnswered]);

  // Re-shuffle the on-screen scatter order for every sub-question, so the same set of
  // response items doesn't sit in memorisable fixed spots across the whole question —
  // only the visual order changes; the underlying item set, images, and click handling
  // (which always references the actual item object, not its position) are untouched.
  useEffect(() => {
    setDisplayResponseItems(shuffle(responseSets[mainScreenNum] || []));
  }, [responseSets, mainScreenNum, subQIndex]);

  // Scatter layouts — measured against the actual rendered grid container, so
  // positions/sizes are always correct for however many items are present (and
  // never overlap or fall outside the visible area). Called unconditionally at
  // the top level per React's rules of hooks, even though each is only rendered
  // on one specific screen.
  const practiceScatter = useScatterLayout(practiceResponseSet.length, 1);
  const mainScatter = useFixedScatterLayout(mainScreenNum, elementPositionLayouts);

  // ── Hide iOS status bar for immersive game experience ───
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.hide().catch(() => {});
    }
    return () => {
      if (Capacitor.isNativePlatform()) {
        StatusBar.show().catch(() => {});
      }
    };
  }, []);

  // ── Login check + resume check ──────────────────────────
  useEffect(() => {
    const dataStr = localStorage.getItem('currentChild');
    if (!dataStr) { navigate('/login', { state: { from: location } }); return; }
    const parsed = JSON.parse(dataStr);
    setChildData(parsed);
    checkResume(parsed.child_id);
    fetchActivity(parsed.child_id);
  }, [navigate]);

  const fetchActivity = async (childId) => {
    try {
      const res = await axios.get(`${API_URL}/games/sessions/summaries/${childId}`);
      if (res.data.success) {
        const summary = res.data.summaries.find(s => s.game_name === GAME_NAME);
        if (summary) {
          setActivityData({
            lastPlayed: formatDate(summary.last_played_at),
            attempts: summary.total_attempts
          });
        }
      }
    } catch (e) {
      console.error('Activity fetch error', e);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/am|pm/g, match => match.toUpperCase());
  };

  // ── Splash audio autoplay ───────────────────────────────
  useEffect(() => {
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && splashAudioRef.current && !audioFinished) {
      splashAudioRef.current.currentTime = 0;
      splashAudioRef.current.play().catch(() => setAudioFinished(true));
    }
  }, [isCheckingSession, screen, showResumeModal, audioFinished]);

  // ── Session timer (runs during game AND score screen until assessment submitted) ─────
  useEffect(() => {
    if ((screen === 'game' && !showQuitModal) || (screen === 'score' && !assessmentSubmitted)) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, showQuitModal, assessmentSubmitted]);

  // ── Question timer ──────────────────────────────────────
  useEffect(() => {
    if (screen === 'game' && mainPhase === 'response' && !showQuitModal && !subQAnswered[subQIndex]) {
      const id = setInterval(() => setQTimer(p => p + 1), 1000);
      return () => clearInterval(id);
    }
  }, [screen, mainPhase, subQIndex, showQuitModal, subQAnswered]);

  // ─── API ────────────────────────────────────────────────
  const checkResume = async (childId) => {
    setIsCheckingSession(true);
    try {
      const res = await axios.get(`${API_URL}/games/sessions/resume/${childId}/${GAME_NAME}`);
      if (res.data.sessionInfo) {
        setResumeData(res.data.sessionInfo);
        setShowResumeModal(true);
      }
    } catch (e) {
      console.error('Resume check error', e);
    } finally {
      setIsCheckingSession(false);
    }
  };

  const startNewGame = async () => {
    try {
      const res = await axios.post(`${API_URL}/games/sessions/start`, {
        child_id: childData.child_id,
        game_name: GAME_NAME,
        total_questions: TOTAL_MAX_SUB_QUESTIONS,
      });
      setGameSessionId(res.data.sessionId);
      setAttemptNo(res.data.attempt_no || 1);
    } catch (e) {
      console.error('Failed to start session', e);
    }
    resetInternalState();
    const sets = generateAllResponseSets();
    setResponseSets(sets);
    setScreen('game');
  };

  const resumeGame = () => {
    const saved = resumeData.saved_state || {};
    setGameSessionId(resumeData.id);
    setAttemptNo(resumeData.attempt_no || 1);
    const scores = saved.allScores || [];
    setAllScores(scores); allScoresRef.current = scores;
    setTimerSeconds(saved.timerSeconds || 0);
    setQTimer(saved.qTimer || 0);
    setPauses(saved.pauses || []);
    setMainScreenNum(saved.mainScreenNum || 1);
    setMainPhase('question');
    setSubQIndex(0);
    setSubQAnswered({});
    setGridFeedback({});
    const sets = generateAllResponseSets();
    setResponseSets(sets);
    setShowResumeModal(false);
    setScreen('game');
  };

  const resetInternalState = () => {
    setAllScores([]); allScoresRef.current = [];
    setTimerSeconds(0); timerSecondsRef.current = 0;
    setQTimer(0); qTimerRef.current = 0;
    setPauses([]); pausesRef.current = [];
    setMainScreenNum(1); mainScreenNumRef.current = 1;
    setMainPhase('question');
    setSubQIndex(0); subQIndexRef.current = 0;
    setSubQAnswered({}); subQAnsweredRef.current = {}; replayCountsRef.current = {}; firstAttemptDoneRef.current = {};
    setGridFeedback({});
    setSubQAudioDone(false);
    setQuestionAudioDone(false);
    setFeedbackAudioPlaying(false);
    itemExposureReplaysRef.current = {};
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
    setQuitReason('');
    setAssessmentSubmitted(false);
  };

  const saveToServer = useCallback(async (status, reason) => {
    const sessId = gameSessionIdRef.current;
    if (!sessId) return;
    try {
      const scores = allScoresRef.current;
      let updatedPauses = [...pausesRef.current];
      if (reason && (status === 'paused' || status === 'quit')) {
        updatedPauses.push({ questionNumber: mainScreenNumRef.current, reason, timestamp: new Date().toISOString() });
        setPauses(updatedPauses);
      }
      await axios.put(`${API_URL}/games/sessions/update/${sessId}`, {
        score: scores.reduce((s, a) => s + a.score, 0),
        progress_level: mainScreenNumRef.current,
        status,
        quit_reason: reason || null,
        saved_state: {
          allScores: scores,
          timerSeconds: timerSecondsRef.current,
          qTimer: qTimerRef.current,
          pauses: updatedPauses,
          mainScreenNum: mainScreenNumRef.current,
          itemExposureReplays: itemExposureReplaysRef.current,
        },
      });
    } catch (e) { console.error('Save error', e); }
  }, []);

  const completeGame = useCallback((status = 'completed') => {
    const scores = allScoresRef.current;
    const sessId = gameSessionIdRef.current;
    if (sessId) {
      axios.put(`${API_URL}/games/sessions/update/${sessId}`, {
        score: scores.reduce((s, a) => s + a.score, 0),
        progress_level: TOTAL_MAX_SUB_QUESTIONS,
        status,
        saved_state: { allScores: scores, timerSeconds: timerSecondsRef.current, pauses: pausesRef.current, mainScreenNum: 13 },
      }).catch(e => console.error(e));
    }
    setScreen('score');
  }, []);

  // ─── Auto-play Main Game Audio ───────────────────────────
  useEffect(() => {
    if (screen === 'game' && mainPhase === 'question') {
      setQuestionAudioDone(false);
      const cfg = SCREEN_CONFIGS.find(c => c.num === mainScreenNumRef.current);
      if (cfg) {
        const qi = itemByStem[cfg.questionStem];
        if (qi?.audio) {
          const audio = new Audio(qi.audio);
          activeAudioRef.current = audio;
          audio.play().catch(() => setQuestionAudioDone(true));
          audio.addEventListener('ended', () => setQuestionAudioDone(true));
          audio.addEventListener('error', () => setQuestionAudioDone(true));
        } else {
          setQuestionAudioDone(true);
        }
      }
    }
  }, [screen, mainPhase, mainScreenNum]);

  useEffect(() => {
    if (screen === 'game' && mainPhase === 'response') {
      setSubQAudioDone(false);
      const cfg = SCREEN_CONFIGS.find(c => c.num === mainScreenNumRef.current);
      if (cfg && cfg.subQStems[subQIndex]) {
        const item = itemByStem[cfg.subQStems[subQIndex]];
        if (item?.khaHai) {
          const audio = new Audio(item.khaHai);
          activeAudioRef.current = audio;
          audio.play().catch(() => setSubQAudioDone(true));
          audio.addEventListener('ended', () => setSubQAudioDone(true));
          audio.addEventListener('error', () => setSubQAudioDone(true));
        } else {
          setSubQAudioDone(true);
        }
      }
    }
  }, [screen, mainPhase, mainScreenNum, subQIndex]);

  // ─── Practice helpers ────────────────────────────────────
  const pickPracticeItem = () => {
    const item = ITEMS.find(i => i.stem === 'bird_ba');
    setPracticeItem(item);
    setPracticeFeedback({});
    setPracticeAnswered(false);
    setPracticeCorrect(false);
    setPracticeAudioDone(false);
  };

  // Auto-play practice audio when practice_q screen loads
  useEffect(() => {
    if (screen === 'practice_q' && practiceItem?.audio) {
      setPracticeAudioDone(false);
      const audio = new Audio(practiceItem.audio);
      activeAudioRef.current = audio;
      audio.play().catch(() => setPracticeAudioDone(true));
      audio.addEventListener('ended', () => setPracticeAudioDone(true));
      audio.addEventListener('error', () => setPracticeAudioDone(true));
    }
  }, [screen, practiceItem]);

  // Auto-play kha_hai audio + build stable response set when practice_r loads
  useEffect(() => {
    if (screen === 'practice_r' && practiceItem) {
      setPracticeResponseAudioDone(false);
      setPracticeResponseSet(buildResponseSet({ requiredStems: [practiceItem.stem], responseCount: 7 }));
      if (practiceItem.khaHai) {
        const audio = new Audio(practiceItem.khaHai);
        activeAudioRef.current = audio;
        audio.play().catch(() => setPracticeResponseAudioDone(true));
        audio.addEventListener('ended', () => setPracticeResponseAudioDone(true));
        audio.addEventListener('error', () => setPracticeResponseAudioDone(true));
      } else {
        setPracticeResponseAudioDone(true);
      }
    }
  }, [screen, practiceItem]);

  const handlePracticeAnswer = (chosenItem) => {
    if (practiceAnswered) return;
    setPracticeAnswered(true);
    if (chosenItem.id === practiceItem.id) {
      setPracticeCorrect(true);
      playAudio(`${AUD}/bilkul_sahi.wav`);
    } else {
      setPracticeCorrect(false);
      playAudio(`${AUD}/Dubara koshish karte hai.wav`);
    }
  };

  // ─── Audio helpers ────────────────────────────────────────
  const playAudio = (src) => {
    if (!src) return;
    if (activeAudioRef.current) {
      try { 
        activeAudioRef.current.pause();
        // Force resolve any ongoing audio states since it was interrupted by selection
        setPracticeResponseAudioDone(true);
        setSubQAudioDone(true);
        setQuestionAudioDone(true);
        setPracticeAudioDone(true);
      } catch (_) {}
    }
    setFeedbackAudioPlaying(true);
    const audio = new Audio(src);
    activeAudioRef.current = audio;
    audio.play().catch(() => setFeedbackAudioPlaying(false));
    audio.addEventListener('ended', () => setFeedbackAudioPlaying(false));
    audio.addEventListener('error', () => setFeedbackAudioPlaying(false));
  };

  // Promise-based audio playback, used to sequence the Q1 retry feedback.
  const playAudioAsync = (src) => new Promise((resolve) => {
    if (!src) { resolve(); return; }
    if (activeAudioRef.current) {
      try { activeAudioRef.current.pause(); } catch (_) {}
    }
    setFeedbackAudioPlaying(true);
    const audio = new Audio(src);
    activeAudioRef.current = audio;
    const done = () => { setFeedbackAudioPlaying(false); resolve(); };
    audio.play().catch(done);
    audio.addEventListener('ended', done);
    audio.addEventListener('error', done);
  });

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Per-screen, per-sub-question incorrect-answer retry sequences, keyed as
  // `${mainScreenNum}_${subQIndex}`. Each entry returns its ordered steps for
  // the given target item. Sub-questions with no entry keep the legacy
  // single-attempt lock (no retry).
  const RETRY_FLOWS = {
    '1_0': (target) => [
      { audio: target.audio },
      { delay: 2000 },
      { unhighlight: true },
      { audio: `${AUD}/Dubara koshish karte hai.wav` },
      { shuffle: true },
      { delay: 2000 },
      { audio: target.khaHai },
    ],
    '2_0': (target) => [
      { audio: target.audio },
      { delay: 2000 },
      { unhighlight: true },
      { shuffle: true },
      { audio: target.khaHai },
    ],
    '2_1': (target) => [
      { audio: target.audio },
      { delay: 2000 },
      { unhighlight: true },
      { shuffle: true },
      { audio: target.khaHai },
    ],
    '3_0': (target) => [
      { audio: target.audio },
      { delay: 2000 },
      { unhighlight: true },
      { shuffle: true },
      { audio: target.khaHai },
    ],
    '3_1': (target) => [
      { audio: target.audio },
      { delay: 2000 },
      { unhighlight: true },
      { shuffle: true },
      { audio: target.khaHai },
    ],
  };

  // ─── Main game answer handler ─────────────────────────────
  const handleMainAnswer = useCallback((chosenItem) => {
    const cfg = SCREEN_CONFIGS.find(c => c.num === mainScreenNumRef.current);
    if (!cfg) return;
    const sqIdx = subQIndexRef.current;
    if (subQAnsweredRef.current[sqIdx]) return;
    if (isRetryingRef.current) return;

    const targetStem = cfg.subQStems[sqIdx];
    const target = itemByStem[targetStem];
    if (!target) return;

    const retryFlow = RETRY_FLOWS[`${mainScreenNumRef.current}_${sqIdx}`];
    const isCorrect = chosenItem.id === target.id;

    // Score only the very first attempt at this sub-question.
    if (!firstAttemptDoneRef.current[sqIdx]) {
      firstAttemptDoneRef.current[sqIdx] = true;
      const pts = scoreAnswer(chosenItem, target);
      const newEntry = {
        qId: `r${mainScreenNumRef.current}_q${sqIdx + 1}`,
        screen: mainScreenNumRef.current,
        subQ: sqIdx + 1,
        targetStem,
        targetName: target.name,
        chosenStem: chosenItem.stem,
        chosenName: chosenItem.name,
        score: pts,
        timeTaken: qTimerRef.current,
        replayCount: replayCountsRef.current[sqIdx] ?? 0,
      };
      const updScores = [...allScoresRef.current];
      updScores.push(newEntry);
      allScoresRef.current = updScores;
      setAllScores(updScores);
    }

    if (isCorrect) {
      if (mainScreenNumRef.current === 13 && sqIdx === 5) {
        playAudio(`${AUD}/bilkul_sahi_2.wav`);
      } else {
        playAudio(`${AUD}/bilkul_sahi.wav`);
      }
      setGridFeedback({});
      const updAnswered = { ...subQAnsweredRef.current, [sqIdx]: true };
      subQAnsweredRef.current = updAnswered;
      setSubQAnswered(updAnswered);
      return;
    }

    if (retryFlow) {
      // Retry loop: highlight the correct item, walk through its feedback
      // sequence, and let the child try again. Score has already been
      // locked in above.
      isRetryingRef.current = true;
      setIsRetrying(true);
      setGridFeedback({ [target.id]: 'correct' });
      (async () => {
        for (const step of retryFlow(target)) {
          if (step.audio) await playAudioAsync(step.audio);
          else if (step.delay) await delay(step.delay);
          else if (step.unhighlight) setGridFeedback({});
          else if (step.shuffle) {
            setDisplayResponseItems(prev => shuffle([...prev]));
          }
        }
        isRetryingRef.current = false;
        setIsRetrying(false);
      })();
      return;
    }

    // All other screens keep the existing single-attempt lock behavior.
    if (!isCorrect && mainScreenNumRef.current >= 4 && mainScreenNumRef.current <= 12) {
      setGridFeedback({ [target.id]: 'correct' });
      isRetryingRef.current = true;
      setIsRetrying(true);
      (async () => {
        const pAudio = target.audio ? playAudioAsync(target.audio) : Promise.resolve();
        const pDelay = delay(3000);
        await Promise.all([pAudio, pDelay]);
        setGridFeedback({});
        isRetryingRef.current = false;
        setIsRetrying(false);
        const updAnswered = { ...subQAnsweredRef.current, [sqIdx]: true };
        subQAnsweredRef.current = updAnswered;
        setSubQAnswered(updAnswered);
      })();
      return;
    }
    const updAnswered = { ...subQAnsweredRef.current, [sqIdx]: true };
    subQAnsweredRef.current = updAnswered;
    setSubQAnswered(updAnswered);
  }, []);

  const advanceToNextScreen = useCallback(() => {
    const currentNum = mainScreenNumRef.current;
    const cfg = SCREEN_CONFIGS.find(c => c.num === currentNum);

    // Check checkpoint
    if (cfg?.checkpoint) {
      const pts = allScoresRef.current.reduce((s, a) => s + a.score, 0);
      if (pts <= cfg.checkpoint.threshold) {
        completeGame('dropped');
        return;
      }
    }

    const nextNum = currentNum + 1;
    if (nextNum > 13) {
      completeGame();
      return;
    }

    mainScreenNumRef.current = nextNum;
    setMainScreenNum(nextNum);
    if (nextNum === 13) {
      setMainPhase('response');
    } else {
      setMainPhase('question');
    }
    setSubQIndex(0); subQIndexRef.current = 0;
    setSubQAnswered({}); subQAnsweredRef.current = {}; replayCountsRef.current = {}; firstAttemptDoneRef.current = {};
    setGridFeedback({});
    setSubQAudioDone(false);
    setQuestionAudioDone(false);
    setFeedbackAudioPlaying(false);
    setQTimer(0); qTimerRef.current = 0;
    saveToServer('in_progress');
  }, [completeGame, saveToServer]);

  const handleQuit = async (status) => {
    if (!quitReason.trim()) { alert(t('common.enterReason')); return; }
    await saveToServer(status, quitReason);
    if (status === 'quit') {
      setShowQuitModal(false);
      setScreen('score');
      // Wait for score screen to render then upload PDF
      setTimeout(() => {
        generateAndUploadPDF();
      }, 1000);
    } else {
      navigate('/');
    }
  };

  // ─── STT ─────────────────────────────────────────────────
  const toggleRecording = (target) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert(t('common.speechNotSupported')); return; }
    if (isRecording && recordingTarget === target) {
      if (window.activeRecognition) {
        window.activeRecognition.onend = null;
        window.activeRecognition.onerror = null;
        try { window.activeRecognition.stop(); } catch(e) {}
      }
      setIsRecording(false); setRecordingTarget(null); return;
    }

    // Explicitly kill any zombie hardware lock before creating a new one
    if (window.activeRecognition) {
      window.activeRecognition.onend = null;
      window.activeRecognition.onerror = null;
      try { window.activeRecognition.stop(); } catch(e) {}
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = STT_LANG_MAP[language] || 'en-US';
    recognition.onresult = (event) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
      }
      if (final) {
        if (target === 'quitReason') setQuitReason(p => p + final);
        else if (target === 'assessmentNotes') setAssessment(p => ({ ...p, notes: p.notes + final }));
      }
    };
    recognition.onend = () => { setIsRecording(false); setRecordingTarget(null); };
    recognition.onerror = (e) => { 
      setIsRecording(false); 
      setRecordingTarget(null); 
      alert(t('game.speechError') + ' / iPad Error: ' + (e.error || 'unknown'));
    };
    window.activeRecognition = recognition;
    recognition.start();
    setIsRecording(true);
    setRecordingTarget(target);
  };

  const generateAndUploadPDF = async () => {
    try {
      const element = document.getElementById('dashboard-capture-area');
      if (!element) return;
      
      document.body.classList.add('pdf-capturing');
      await new Promise(r => setTimeout(r, 100));
      
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, { 
        scale: 1.5, 
        useCORS: true,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Use dynamic height to prevent cropping long dashboards
      const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      
      const pdfBlob = pdf.output('blob');
      
      const formData = new FormData();
      const childNameSafe = (childData?.name || childData?.child_id || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
      const ts = new Date().toISOString().replace(/[:.T-]/g, '').slice(0, 14);
      formData.append('pdf', pdfBlob, `${childNameSafe}_Bagiya_SES${gameSessionId}_${ts}.pdf`);
      formData.append('child_id', childData?.child_id);
      formData.append('session_id', gameSessionId);
      formData.append('game_name', 'atlantis_bagiya');
      
      await axios.post(`${API_URL}/games/pdfs/upload`, formData);
    } catch (e) {
      console.error('Failed to generate and upload PDF:', e);
    } finally {
      document.body.classList.remove('pdf-capturing');
    }
  };

  // ─── Assessment submit ────────────────────────────────────
  const submitAssessmentForm = async () => {
    setIsAssessmentSubmitting(true);
    try {
      await axios.post(`${API_URL}/games/assessments`, {
        session_id: gameSessionId,
        child_id: childData.child_id,
        q1_enjoyment: assessment.q1,
        q2_feeling: assessment.q2,
        q3_tiredness: assessment.q3,
        q4_play_again: assessment.q4,
        q5_behaviors: assessment.behaviors,
        additional_notes: assessment.notes,
      });

      // Save final screentime (stops here) to session so admin panel reflects it
      if (gameSessionId) {
        axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
          saved_state: { allScores: allScoresRef.current, timerSeconds: timerSecondsRef.current, pauses: pausesRef.current, mainScreenNum: 13, screentime: timerSecondsRef.current },
        }).catch(e => console.error('Screentime save error', e));
      }

      setAssessmentSubmitted(true);
      setShowGrid(true); // Force grid to open so questions are captured
      
      // Wait for DOM to render the grid and any CSS transitions before capturing
      setTimeout(() => {
        generateAndUploadPDF();
      }, 500);
      
      alert(t('game.assessmentSubmitted'));
    } catch (e) {
      console.error(e);
      alert(t('common.failedToSave'));
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  // ─── Score screen helpers ─────────────────────────────────
  const totalPts = allScores.reduce((s, a) => s + a.score, 0);
  const maxPts = 108;
  const correctCount = allScores.filter(s => s.score === 2).length;
  const partialCount = allScores.filter(s => s.score === 1).length;
  const wrongCount   = allScores.filter(s => s.score === 0).length;
  const accuracyPct  = ((totalPts / 108) * 100).toFixed(1);
  const totalTimeSec = allScores.reduce((acc, s) => acc + (s.timeTaken || 0), 0);

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <div className="ab-app">

      {/* ── Topbar ── */}
      <header className="ab-topbar">
        <div className="ab-brand">
          {showLogo && <img src="/cel_admin_logo.png" alt="CEL Logo" className="ab-brand-img" />}
          {showLogo && (showGameIcon || showGameName) && <div className="ab-divider"></div>}
          {showGameIcon && <img src={bagiyaImage} alt="Bagiya" className="ab-test-logo" />}
          {showGameName && <span className="ab-test-title">{t('home.games.bagiya.title')}</span>}
        </div>

        {/* ── Centre: screen label ── */}
        <div className="ab-topbar-center">
          {screen === 'practice_q' && (
            <div className="ab-topbar-screen-title">
              {t('game.practiceQuestion')}
            </div>
          )}
          {screen === 'practice_r' && (
            <div className="ab-topbar-screen-title">{t('game.practiceResponse')}</div>
          )}
          {screen === 'game' && mainPhase === 'question' && (
            <div className="ab-topbar-screen-title">{t('game.question')} {mainScreenNum === 13 ? '12.B' : mainScreenNum}</div>
          )}
          {screen === 'game' && mainPhase === 'response' && currentConfig && (
            <>
              <div className="ab-topbar-screen-title">{t('game.responseLabel')} {mainScreenNum === 13 ? '12.B' : mainScreenNum}</div>
              <div className="ab-topbar-screen-sub">
                {currentConfig.subQStems.every((_, i) => subQAnswered[i])
                  ? t('game.allAnswered')
                  : `${t('game.subQuestion')} ${subQIndex + 1} ${t('game.of')} ${currentConfig.subQStems.length}`}
              </div>
            </>
          )}
        </div>

        <div className="ab-stats">
          {showChildId && childData?.child_id && (
            <div className="ab-stat-pill">
              <span className="ab-stat-icon">👤</span>
              <span className="ab-stat-value">{childData.child_id}</span>
            </div>
          )}
          {showTimer && screen === 'game' && mainPhase === 'response' && (
            <div className="ab-stat-pill">
              <span className="ab-stat-icon">⏱</span>
              <span className="ab-stat-value">{formatTime(qTimer)}</span>
            </div>
          )}
          {showScore && (
          <div className="ab-stat-pill">
            <span className="ab-stat-icon">🏆</span>
            <span className="ab-stat-value">{totalScore}</span>
          </div>
          )}
          {screen === 'game' && (
            <button className="btn-pause-quit" onClick={() => { setQuitReason(''); setShowQuitModal(true); }}>
              <span>⏸</span> {t('game.pauseQuit')}
            </button>
          )}
        </div>
      </header>

      <main className={`ab-main${screen === 'splash' ? ' ab-main-splash' : ''}`}>

        {/* ── SPLASH ── */}
        {!isCheckingSession && screen === 'splash' && !showResumeModal && (
          <div className="ab-screen ab-screen-splash">
            <div className="ab-splash-cover">
              <img
                src={bagiyaImage}
                alt="Bagiya"
                className="ab-splash-img-full"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="ab-splash-btn-overlay">
                <button
                  className={`ab-btn ab-btn-primary${!audioFinished ? ' ab-btn-disabled' : ' ab-btn-highlight'}`}
                  disabled={!audioFinished}
                  onClick={startNewGame}
                >
                  {t('game.startNow')}
                </button>
                <button
                  className="ab-btn ab-btn-secondary"
                  onClick={() => {
                    if (splashAudioRef.current) {
                      setAudioFinished(false);
                      splashAudioRef.current.currentTime = 0;
                      splashAudioRef.current.play().catch(() => setAudioFinished(true));
                    }
                  }}
                >
                  {t('game.reply')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PRACTICE QUESTION ── */}
        {screen === 'practice_q' && practiceItem && (
          <div className="ab-screen">
            <div className="ab-splash-centered">
              <div className="ab-question-img-box">
                <img src={practiceItem.img} alt={practiceItem.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              </div>
              <div className="ab-btn-row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <button
                  className="ab-btn ab-btn-secondary"
                  onClick={() => {
                    setPracticeAudioDone(false);
                    const audio = new Audio(practiceItem.audio);
                    activeAudioRef.current = audio;
                    audio.play().catch(() => setPracticeAudioDone(true));
                    audio.addEventListener('ended', () => setPracticeAudioDone(true));
                    audio.addEventListener('error', () => setPracticeAudioDone(true));
                  }}
                >
                  {t('game.reply')}
                </button>
                <button
                  className={`ab-btn ab-btn-primary${!practiceAudioDone ? ' ab-btn-disabled' : ''}`}
                  disabled={!practiceAudioDone}
                  onClick={() => setScreen('practice_r')}
                >
                  {t('game.answer')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PRACTICE RESPONSE ── */}
        {screen === 'practice_r' && practiceItem && (
          <div className="ab-screen">
            <div className="ab-card">
              <div className="ab-grid ab-grid-large" ref={practiceScatter.containerRef}>
                {practiceResponseSet.map((item, i) => {
                  const pos = practiceScatter.positions[i];
                  return (
                    <div
                      key={item.id}
                      className={`ab-grid-item${(practiceAnswered || !practiceResponseAudioDone) ? ' locked' : ''}`}
                      style={pos ? { left: pos.left, top: pos.top, width: pos.size, height: pos.size } : { visibility: 'hidden' }}
                      onClick={() => {
                        if (practiceResponseAudioDone) handlePracticeAnswer(item);
                      }}
                    >
                      <img src={item.img} alt={item.name} className="ab-grid-item-img-large" />
                    </div>
                  );
                })}
              </div>

              <div className="ab-btn-row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                <button
                  className={`ab-btn ab-btn-secondary${practiceAnswered ? ' ab-btn-disabled' : ''}`}
                  disabled={practiceAnswered}
                  onClick={() => {
                    setPracticeResponseAudioDone(false);
                    const audio = new Audio(practiceItem.khaHai);
                    activeAudioRef.current = audio;
                    audio.play().catch(() => setPracticeResponseAudioDone(true));
                    audio.addEventListener('ended', () => setPracticeResponseAudioDone(true));
                    audio.addEventListener('error', () => setPracticeResponseAudioDone(true));
                  }}>
                  {t('game.reply')}
                </button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    className={`ab-btn ${practiceAnswered && !practiceCorrect && !feedbackAudioPlaying ? 'ab-pulse-warning' : 'ab-btn-secondary'}${feedbackAudioPlaying ? ' ab-btn-disabled' : ''}`}
                    disabled={feedbackAudioPlaying}
                    onClick={() => { pickPracticeItem(); setScreen('practice_q'); }}
                  >
                    {t('game.tryAgain')}
                  </button>
                  <button
                    className={`ab-btn ab-btn-primary${!(practiceResponseAudioDone && practiceAnswered && practiceCorrect && !feedbackAudioPlaying) ? ' ab-btn-disabled' : ''}`}
                    disabled={!(practiceResponseAudioDone && practiceAnswered && practiceCorrect && !feedbackAudioPlaying)}
                    onClick={() => {
                      const sets = generateAllResponseSets();
                      setResponseSets(sets);
                      setMainScreenNum(1); mainScreenNumRef.current = 1;
                      setMainPhase('question');
                      setSubQIndex(0); subQIndexRef.current = 0;
                      setSubQAnswered({}); subQAnsweredRef.current = {}; replayCountsRef.current = {}; firstAttemptDoneRef.current = {};
                      setGridFeedback({});
                      setScreen('game');
                    }}>
                    {t('game.startMainGame')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN GAME ── */}
        {screen === 'game' && currentConfig && (
          <div className="ab-screen">
            {mainPhase === 'question' && (
              <>
                {(() => {
                  const qi = itemByStem[currentConfig.questionStem];
                  return (
                    <div className="ab-splash-centered">
                      <div className="ab-question-img-box">
                        <img src={qi.img} alt={qi.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      </div>
                      <div className="ab-btn-row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                        <button className="ab-btn ab-btn-secondary"
                          onClick={() => {
                            itemExposureReplaysRef.current[mainScreenNumRef.current] = (itemExposureReplaysRef.current[mainScreenNumRef.current] || 0) + 1;
                            setQuestionAudioDone(false);
                            if (qi?.audio) {
                              const audio = new Audio(qi.audio);
                              activeAudioRef.current = audio;
                              audio.play().catch(() => setQuestionAudioDone(true));
                              audio.addEventListener('ended', () => setQuestionAudioDone(true));
                              audio.addEventListener('error', () => setQuestionAudioDone(true));
                            }
                          }}>
                  {t('game.reply')}
                        </button>
                        <button
                          className={`ab-btn ab-btn-primary${!questionAudioDone ? ' ab-btn-disabled' : ''}`}
                          disabled={!questionAudioDone}
                          style={{ minWidth: 160, padding: '13px 36px', fontSize: '1rem' }}
                          onClick={() => {
                            setMainPhase('response');
                            setSubQIndex(0); subQIndexRef.current = 0;
                            setSubQAnswered({}); subQAnsweredRef.current = {}; replayCountsRef.current = {}; firstAttemptDoneRef.current = {};
                            setGridFeedback({});
                            setSubQAudioDone(false);
                            setQTimer(0); qTimerRef.current = 0;
                          }}>
                          {`${t('game.responseLabel')} ${mainScreenNum === 13 ? '12.B' : mainScreenNum}`}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {mainPhase === 'response' && (() => {
              const responseItems = responseSets[mainScreenNum] || [];
              // Fall back to the unshuffled set for the single frame before the
              // reshuffle effect (keyed on subQIndex) has run, so nothing is missing.
              const itemsToRender = displayResponseItems.length ? displayResponseItems : responseItems;

              const allSubQsDone = currentConfig.subQStems.every((_, i) => subQAnswered[i]);
              const activeTargetStem = currentConfig.subQStems[subQIndex];
              const activeTarget = itemByStem[activeTargetStem];

              return (
                <>
                  <div className="ab-card">
                    {/* Response grid */}
                    <div className="ab-grid ab-grid-large" ref={mainScatter.containerRef}>
                      {itemsToRender.map((item, i) => {
                        const pos = mainScatter.positions[i];
                        return (
                          <div
                            key={item.id}
                            className={`ab-grid-item${(subQAnswered[subQIndex] || !subQAudioDone || isRetrying) && gridFeedback[item.id] !== 'correct' ? ' locked' : ''}${gridFeedback[item.id] === 'correct' ? ' correct' : ''}`}
                            style={pos ? { left: pos.left, top: pos.top, width: pos.size, height: pos.size } : { visibility: 'hidden' }}
                            onClick={() => {
                              if (subQAudioDone && !isRetrying) handleMainAnswer(item);
                            }}
                          >
                            <img 
                              src={item.img} 
                              alt={item.name} 
                              className="ab-grid-item-img-large" 
                              style={mainScreenNum >= 9 && mainScreenNum <= 13 ? { transform: 'scale(0.8)' } : {}}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom row: Replay Audio left, Next right */}
                    <div className="ab-btn-row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                      <button
                        className={`ab-btn ab-btn-secondary${(subQAnswered[subQIndex] || isRetrying) ? ' ab-btn-disabled' : ''}`}
                        disabled={!!subQAnswered[subQIndex] || isRetrying}
                        onClick={() => {
                          replayCountsRef.current[subQIndex] = (replayCountsRef.current[subQIndex] || 0) + 1;
                          setSubQAudioDone(false);
                          const item = itemByStem[currentConfig.subQStems[subQIndex]];
                          const handleDone = () => {
                            setDisplayResponseItems(prev => shuffle([...prev]));
                            setSubQAudioDone(true);
                          };
                          
                          if (item?.khaHai) {
                            const audio = new Audio(item.khaHai);
                            activeAudioRef.current = audio;
                            audio.play().catch(handleDone);
                            audio.addEventListener('ended', handleDone);
                            audio.addEventListener('error', handleDone);
                          } else {
                            handleDone();
                          }
                        }}>
                        {t('game.reply')}
                      </button>
                      <button
                        className={`ab-btn ab-btn-primary${!(subQAudioDone && subQAnswered[subQIndex] && !feedbackAudioPlaying) ? ' ab-btn-disabled' : ''}`}
                        disabled={!(subQAudioDone && subQAnswered[subQIndex] && !feedbackAudioPlaying)}
                        onClick={() => {
                          if (subQIndex < currentConfig.subQStems.length - 1) {
                            const nextIdx = subQIndex + 1;
                            setSubQIndex(nextIdx);
                            subQIndexRef.current = nextIdx;
                            setGridFeedback({});
                            setQTimer(0); qTimerRef.current = 0;
                          } else {
                            advanceToNextScreen();
                          }
                        }}>
                        {subQIndex < currentConfig.subQStems.length - 1
                          ? t('game.nextQuestion')
                          : (mainScreenNum < 13
                              ? (mainScreenNum === 12 ? `${t('game.question')} 12.B` : `${t('game.question')} ${mainScreenNum + 1}`)
                              : t('game.finishGame'))}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── SCORE ── */}
        {screen === 'score' && (
          <div className="ab-screen" id="dashboard-capture-area">
            <div className="ab-screen-header">
              <div>
                <div className="ab-screen-title">{quitReason ? t('game.assessmentTerminated') : t('game.assessmentComplete')}</div>
                {quitReason && (
                  <div className="ab-screen-subtitle">{t('game.reasonLabel')} {quitReason}</div>
                )}
              </div>
              <div className="ab-chips">
                <span className="ab-chip" style={{ background: '#4f46e5', color: '#fff' }}>{t('game.attemptLabel')}{attemptNo}</span>
                <span className="ab-chip">{t('game.timeChip')} {formatTime(timerSeconds)}</span>
              </div>
            </div>

            <div className="ab-result-card">
              {/* Score summary */}
              <div className="ab-score-top">
                <div className="ab-score-dial">
                  <div className="ab-score-big">{totalPts}</div>
                  <div className="ab-score-label">/ {maxPts} {t('game.ptsLabel')}</div>
                </div>
                <div className="ab-metric-grid">
                  {[
                    { label: t('game.exactLabel'),    val: correctCount, cls: 'green' },
                    { label: t('game.partialLabel'),  val: partialCount, cls: '' },
                    { label: t('game.wrongLabel'),    val: wrongCount, cls: 'red' },
                    { label: t('game.accuracyLabel'), val: `${accuracyPct}%`, sub: `${totalPts} / ${maxPts}`, cls: '', info: true },
                    { label: t('game.totalTimeMetric'), val: formatTime(totalTimeSec), cls: '' },
                    { label: t('game.screensLabel'),  val: `${SCREEN_CONFIGS.findIndex(c => c.num === mainScreenNum) + 1} / 13`, cls: '' },
                  ].map((m, i) => (
                    <div key={i} className="ab-metric-box">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {m.label}
                        {m.info && <span className="kpi-formula-icon" data-tooltip="Correct Answers ÷ Total Attempted × 100">ⓘ</span>}
                      </label>
                      <div className={`ab-metric-val ${m.cls}`}>{m.val}</div>
                      {m.sub && <div className="ab-metric-sub">{m.sub}</div>}
                    </div>
                  ))}
                </div>
              </div>



              {/* Per-question results */}
              <div className="ab-q-table-wrap">
                <table className="ab-q-table">
                  <thead>
                    <tr>
                      <th>{t('game.sNo')}</th>
                      <th>{t('game.screenHeader')}</th>
                      <th>{t('game.question')}</th>
                      <th>Item Replays</th>
                      <th>{t('game.responseLabel')}</th>
                      <th>{t('game.targetHeader')}</th>
                      <th>{t('game.childChoseHeader')}</th>
                      <th>{t('game.statusHeader')}</th>
                      <th>{t('game.scoreTable.score')}</th>
                      <th>{t('game.totalTimeMetric')}</th>
                      <th>{t('game.replaysHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allScores.map((s, i) => {
                      const screenCfg = SCREEN_CONFIGS.find(c => c.num === s.screen);
                      const exposureItem = screenCfg ? itemByStem[screenCfg.questionStem] : null;
                      const isFirstOfScreen = i === 0 || s.screen !== allScores[i - 1].screen;
                      return (
                      <tr key={i} className={isFirstOfScreen && i > 0 ? 'ab-screen-group-start' : ''}>
                        <td>{i + 1}</td>
                        <td>{isFirstOfScreen ? (s.screen === 13 ? 'S12.B' : `S${s.screen}`) : ''}</td>
                        <td>
                          {isFirstOfScreen && exposureItem ? (
                            <div className="ab-exposure-cell">
                              <img src={exposureItem.img} alt={exposureItem.name} className="ab-q-img" />
                              <span className="ab-exposure-label">{t('game.exposureLabel')} {exposureItem.name}</span>
                            </div>
                          ) : ''}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {isFirstOfScreen ? (itemExposureReplaysRef.current[s.screen] || 0) : ''}
                        </td>
                        <td>Q{s.subQ}</td>
                        <td>
                          <img src={itemByStem[s.targetStem]?.img} alt={s.targetName} className="ab-q-img" />
                        </td>
                        <td>
                          <img src={itemByStem[s.chosenStem]?.img} alt={s.chosenName} className="ab-q-img" />
                        </td>
                        <td>
                          <span className={`ab-badge ${s.score === 2 ? 'ab-badge-correct' : s.score === 1 ? 'ab-badge-partial' : 'ab-badge-wrong'}`}>
                            {s.score === 2 ? t('game.statusCorrect') : s.score === 1 ? t('game.statusPartial') : t('game.statusWrong')}
                          </span>
                        </td>
                        <td>{s.score}</td>
                        <td>{fmtDuration(s.timeTaken)}</td>
                        <td>{s.replayCount || 0}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Assessment Form */}
              <SessionAssessmentForm
                assessment={assessment}
                setAssessment={setAssessment}
                assessmentSubmitted={assessmentSubmitted}
                isAssessmentSubmitting={isAssessmentSubmitting}
                submitAssessmentForm={submitAssessmentForm}
                isRecording={isRecording}
                recordingTarget={recordingTarget}
                toggleRecording={toggleRecording}
                t={t}
              >
                <>
                  <button onClick={() => { resetInternalState(); setScreen('splash'); setAudioFinished(false); }} className="ab-btn ab-btn-primary">{t('game.retest')}</button>
                  <button onClick={() => navigate('/')} className="ab-btn ab-btn-secondary">{t('game.home')}</button>
                </>
              </SessionAssessmentForm>
            </div>
          </div>
        )}
      </main>

      {/* Splash audio */}
      {!isCheckingSession && (
        <audio
          ref={splashAudioRef}
          src={`${AUD}/splash.wav`}
          preload="auto"
          onEnded={() => setAudioFinished(true)}
          onError={() => setAudioFinished(true)}
        />
      )}

      {/* ── RESUME MODAL ── */}
      {showResumeModal && (
        <div className="ab-modal-overlay">
          <div className="ab-modal">
            <h2>{t('game.progressFound')}</h2>
            <p>{t('game.progressDesc')}</p>
            <div className="ab-btn-row" style={{ marginTop: 12 }}>
              <button className="ab-btn ab-btn-secondary" onClick={() => {
                setShowResumeModal(false);
                resetInternalState();
                setAudioFinished(false);
                setScreen('splash');
              }}>
                {t('game.restartFresh')}
              </button>
              <button className="ab-btn ab-btn-primary" onClick={resumeGame}>
                {t('game.resumeGame')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUIT MODAL ── */}
      {showQuitModal && (
        <div className="ab-modal-overlay">
          <div className="ab-modal">
            <h2>{t('game.pauseQuitTitle')}</h2>
            <p>{t('game.pauseDesc')}</p>
            <div style={{ position: 'relative' }}>
              <textarea
                {...{placeholder: t('game.pausePlaceholder')}}
                value={quitReason}
                onChange={e => setQuitReason(e.target.value)}
                style={{ paddingRight: 44, width: '100%', boxSizing: 'border-box' }}
              />
              <button onClick={() => toggleRecording('quitReason')}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: isRecording && recordingTarget === 'quitReason' ? '#ef4444' : '#e2e8f0',
                  color: isRecording && recordingTarget === 'quitReason' ? 'white' : '#475569',
                  border: 'none', borderRadius: '50%', width: 32, height: 32,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >🎙</button>
            </div>
            <div className="ab-btn-row" style={{ marginTop: 16 }}>
              <button className="ab-btn ab-btn-secondary" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem' }}
                onClick={() => setShowQuitModal(false)}>{t('game.cancel')}</button>
              <button className="ab-btn ab-btn-warning" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem' }}
                onClick={() => handleQuit('paused')}>{t('game.pauseSave')}</button>
              <button className="ab-btn ab-btn-danger" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem' }}
                onClick={() => handleQuit('quit')}>{t('game.quitEnd')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtlantisBagiyaGame;
