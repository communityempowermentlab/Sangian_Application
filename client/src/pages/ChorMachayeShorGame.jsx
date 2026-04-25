import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import './ChorMachayeShorGame.css';

const GAME_NAME = 'chor_machaye_shor';
const TOTAL_QUESTIONS = 11;
const AUDIO_DIR = '/assets/audios/chor_machaye_shor';
const IMG_DIR = '/assets/images/chor_machaye_shor';

// =========================
// GAME DATA - All 11 Items
// =========================
const GAME_DATA = {
  items: [
    // Item 1: Red Roof (with 2 trials)
    {
      id: 1, name: "Item 1: Red Roof", maxAttemptsTrial1: 10, maxAttemptsTrial2: 6, hasTrials: true, maxPhases: 1, consecutiveRequired: 3,
      scoring: {
        trial1: [{ moves: 3, score: 5 }, { minMoves: 4, maxMoves: 6, score: 4 }, { minMoves: 7, maxMoves: 10, score: 3 }],
        trial2: [{ moves: 3, score: 2 }, { minMoves: 4, maxMoves: 6, score: 1 }]
      },
      houses: [
        { initialPosition: 0, isResponseHouse: true, roof: { type: 'equilateral', color: { r: 249, g: 37, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] },
        { initialPosition: 1, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] },
        { initialPosition: 3, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] }
      ]
    },
    // Item 2: House with 1 Window
    {
      id: 2, name: "Item 2: One Window", maxAttempts: 15, maxPhases: 1, consecutiveRequired: 3,
      scoring: [{ minMoves: 3, maxMoves: 4, score: 5 }, { minMoves: 5, maxMoves: 6, score: 4 }, { minMoves: 7, maxMoves: 9, score: 3 }, { minMoves: 10, maxMoves: 12, score: 2 }, { minMoves: 13, maxMoves: 15, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 249, g: 37, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] },
        { initialPosition: 1, isResponseHouse: true, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] },
        { initialPosition: 3, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] }
      ]
    },
    // Item 3: House with 2 Windows
    {
      id: 3, name: "Item 3: Two Windows", maxAttempts: 15, maxPhases: 1, consecutiveRequired: 3,
      scoring: [{ minMoves: 3, maxMoves: 4, score: 5 }, { minMoves: 5, maxMoves: 6, score: 4 }, { minMoves: 7, maxMoves: 9, score: 3 }, { minMoves: 10, maxMoves: 12, score: 2 }, { minMoves: 13, maxMoves: 15, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 249, g: 37, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }] },
        { initialPosition: 1, isResponseHouse: true, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] },
        { initialPosition: 3, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }] }
      ]
    },
    // Item 4: House with No Windows
    {
      id: 4, name: "Item 4: No Windows", maxAttempts: 15, maxPhases: 1, consecutiveRequired: 3,
      scoring: [{ minMoves: 3, maxMoves: 4, score: 5 }, { minMoves: 5, maxMoves: 6, score: 4 }, { minMoves: 7, maxMoves: 9, score: 3 }, { minMoves: 10, maxMoves: 12, score: 2 }, { minMoves: 13, maxMoves: 15, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: true, roof: { type: 'equilateral', color: { r: 249, g: 37, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] },
        { initialPosition: 1, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 3, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }] }
      ]
    },
    // Item 5: Clockwise Movement
    {
      id: 5, name: "Item 5: Clockwise", maxAttempts: 15, maxPhases: 1, consecutiveRequired: 3,
      scoring: [{ minMoves: 3, maxMoves: 5, score: 5 }, { minMoves: 6, maxMoves: 7, score: 4 }, { minMoves: 8, maxMoves: 10, score: 3 }, { minMoves: 11, maxMoves: 13, score: 2 }, { minMoves: 14, maxMoves: 15, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: true, roof: { type: 'equilateral', color: { r: 249, g: 37, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [] },
        { initialPosition: 1, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 3, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }] }
      ]
    },
    // Item 6: Blue Roof OR 4 Windows
    {
      id: 6, name: "Item 6: Blue Roof or 4 Windows", maxAttempts: 18, maxPhases: 2, consecutiveRequired: [2, 3],
      scoring: [{ minMoves: 6, maxMoves: 7, score: 5 }, { minMoves: 8, maxMoves: 9, score: 4 }, { minMoves: 10, maxMoves: 12, score: 3 }, { minMoves: 13, maxMoves: 15, score: 2 }, { minMoves: 16, maxMoves: 18, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 249, g: 37, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }] },
        { initialPosition: 1, isResponseHouse: true, roof: { type: 'equilateral', color: { r: 32, g: 53, b: 251 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }, { position: 'bl', type: 'normal' }, { position: 'br', type: 'normal' }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 3, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }, { position: 'bl', type: 'normal' }] }
      ]
    },
    // Item 7: 3 Windows OR Split Windows
    {
      id: 7, name: "Item 7: 3 Windows or Split", maxAttempts: 18, maxPhases: 2, consecutiveRequired: [2, 3],
      scoring: [{ minMoves: 6, maxMoves: 7, score: 5 }, { minMoves: 8, maxMoves: 9, score: 4 }, { minMoves: 10, maxMoves: 12, score: 3 }, { minMoves: 13, maxMoves: 15, score: 2 }, { minMoves: 16, maxMoves: 18, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 249, g: 37, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }] },
        { initialPosition: 1, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }, { position: 'bl', type: 'normal' }, { position: 'br', type: 'normal' }] },
        { initialPosition: 3, isResponseHouse: true, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'split' }, { position: 'tr', type: 'normal' }, { position: 'bl', type: 'normal' }] }
      ]
    },
    // Item 8: Slanted Roof OR Anticlockwise
    {
      id: 8, name: "Item 8: Slanted or Anticlockwise", maxAttempts: 18, maxPhases: 2, consecutiveRequired: [2, 3],
      scoring: [{ minMoves: 6, maxMoves: 7, score: 5 }, { minMoves: 8, maxMoves: 9, score: 4 }, { minMoves: 10, maxMoves: 12, score: 3 }, { minMoves: 13, maxMoves: 15, score: 2 }, { minMoves: 16, maxMoves: 18, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 249, g: 37, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 1, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 3, isResponseHouse: true, roof: { type: 'right', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] }
      ]
    },
    // Item 9: Red Roof OR Clockwise OR Small Window
    {
      id: 9, name: "Item 9: Red or Clockwise or Small", maxAttempts: 21, maxPhases: 2, consecutiveRequired: [2, 3],
      scoring: [{ minMoves: 6, maxMoves: 8, score: 5 }, { minMoves: 9, maxMoves: 12, score: 4 }, { minMoves: 13, maxMoves: 15, score: 3 }, { minMoves: 16, maxMoves: 18, score: 2 }, { minMoves: 19, maxMoves: 21, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 32, g: 53, b: 251 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 1, isResponseHouse: true, roof: { type: 'equilateral', color: { r: 249, g: 37, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'small' }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 3, isResponseHouse: false, roof: { type: 'equilateral', color: { r: 255, g: 251, b: 0 } }, base: { color: { r: 255, g: 255, b: 255 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] }
      ]
    },
    // Item 10: Yellow Walls OR 2 Crosses OR Right-Slant
    {
      id: 10, name: "Item 10: Yellow or Crosses or Right-Slant", maxAttempts: 21, maxPhases: 2, consecutiveRequired: [2, 3],
      scoring: [{ minMoves: 6, maxMoves: 8, score: 5 }, { minMoves: 9, maxMoves: 12, score: 4 }, { minMoves: 13, maxMoves: 15, score: 3 }, { minMoves: 16, maxMoves: 18, score: 2 }, { minMoves: 19, maxMoves: 21, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: true, roof: { type: 'right', color: { r: 249, g: 37, b: 0 }, crosses: ['left', 'right'] }, base: { color: { r: 255, g: 251, b: 0 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 1, isResponseHouse: false, roof: { type: 'left', color: { r: 255, g: 251, b: 0 }, crosses: ['left'] }, base: { color: { r: 249, g: 37, b: 0 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'left', color: { r: 249, g: 37, b: 0 }, crosses: ['left'] }, base: { color: { r: 34, g: 139, b: 34 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] },
        { initialPosition: 3, isResponseHouse: false, roof: { type: 'left', color: { r: 255, g: 251, b: 0 }, crosses: ['left'] }, base: { color: { r: 32, g: 53, b: 251 } }, windows: [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] }
      ]
    },
    // Item 11: Blue Walls OR Opposite Cross OR Orange Windows
    {
      id: 11, name: "Item 11: Blue or Opposite or Orange", maxAttempts: 21, maxPhases: 2, consecutiveRequired: [2, 3],
      scoring: [{ minMoves: 6, maxMoves: 8, score: 5 }, { minMoves: 9, maxMoves: 12, score: 4 }, { minMoves: 13, maxMoves: 15, score: 3 }, { minMoves: 16, maxMoves: 18, score: 2 }, { minMoves: 19, maxMoves: 21, score: 1 }],
      houses: [
        { initialPosition: 0, isResponseHouse: false, roof: { type: 'right', color: { r: 255, g: 251, b: 0 }, crosses: ['right'] }, base: { color: { r: 255, g: 251, b: 0 } }, windows: [{ position: 'tl', type: 'normal', color: { r: 255, g: 127, b: 80 } }, { position: 'tr', type: 'normal', color: { r: 255, g: 127, b: 80 } }] },
        { initialPosition: 1, isResponseHouse: true, roof: { type: 'left', color: { r: 249, g: 37, b: 0 }, crosses: ['right'] }, base: { color: { r: 32, g: 53, b: 251 } }, windows: [{ position: 'tl', type: 'normal', color: { r: 255, g: 127, b: 80 } }, { position: 'tr', type: 'normal', color: { r: 255, g: 127, b: 80 } }] },
        { initialPosition: 2, isResponseHouse: false, roof: { type: 'left', color: { r: 255, g: 251, b: 0 }, crosses: ['left'] }, base: { color: { r: 249, g: 37, b: 0 } }, windows: [{ position: 'tl', type: 'normal', color: { r: 135, g: 206, b: 235 } }, { position: 'tr', type: 'normal', color: { r: 135, g: 206, b: 235 } }] },
        { initialPosition: 3, isResponseHouse: false, roof: { type: 'left', color: { r: 249, g: 37, b: 0 }, crosses: ['left'] }, base: { color: { r: 34, g: 139, b: 34 } }, windows: [{ position: 'tl', type: 'normal', color: { r: 135, g: 206, b: 235 } }, { position: 'tr', type: 'normal', color: { r: 135, g: 206, b: 235 } }] }
      ]
    }
  ]
};

// =========================
// Helper Functions (Rule Engine / Utils)
// =========================
const rgbToString = (rgb) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
const rgbToColor = (rgb, alpha = 1) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

const isHouseBlueRoof = (h) => h.roof.color.r === 32 && h.roof.color.g === 53 && h.roof.color.b === 251;
const isHouseRedRoof = (h) => h.roof.color.r === 249 && h.roof.color.g === 37;
const isHouseYellowWalls = (h) => h.base.color.r === 255 && h.base.color.g === 251;
const isHouseBlueWalls = (h) => h.base.color.r === 32 && h.base.color.g === 53 && h.base.color.b === 251;

const getCrossCount = (h) => h.roof.crosses ? h.roof.crosses.length : 0;
const hasSplitWindow = (h) => h.windows.some(w => w.type === 'split' || w.type === 'split-horizontal');
const hasSmallWindow = (h) => h.windows.some(w => w.type === 'small');
const hasOrangeWindows = (h) => h.windows.some(w => w.color && w.color.r === 255 && w.color.g === 127 && w.color.b === 80);
const isCrossOppositeToSlant = (h) => {
  if (h.roof.type === 'equilateral') return false;
  const crosses = h.roof.crosses || [];
  if (h.roof.type === 'left' && crosses.includes('right')) return true;
  if (h.roof.type === 'right' && crosses.includes('left')) return true;
  return false;
};

const determinePhase2Rule = (itemId, selectedHouse, lastCorrectPosition) => {
  if (!selectedHouse) return null;
  switch (itemId) {
    case 6: {
      const hasBlueRoof = isHouseBlueRoof(selectedHouse);
      const has4Windows = selectedHouse.windows.length === 4;
      if (hasBlueRoof) return { type: '4_windows', finder: (h) => h.windows.length === 4 };
      if (has4Windows) return { type: 'blue_roof', finder: (h) => isHouseBlueRoof(h) };
      return { type: '4_windows', finder: (h) => h.windows.length === 4 };
    }
    case 7: {
      const has3Windows = selectedHouse.windows.length === 3;
      const isSplit = hasSplitWindow(selectedHouse);
      if (has3Windows) return { type: 'split_windows', finder: (h) => hasSplitWindow(h) };
      if (isSplit) return { type: '3_windows', finder: (h) => h.windows.length === 3 };
      return { type: 'split_windows', finder: (h) => hasSplitWindow(h) };
    }
    case 8: {
      const isSlanted = selectedHouse.roof.type !== 'equilateral';
      const expectedAnticlockwise = (lastCorrectPosition - 1 + 4) % 4;
      const isAnticlockwise = (selectedHouse.currentPosition === expectedAnticlockwise);
      if (isSlanted) return { type: 'anticlockwise' };
      if (isAnticlockwise) return { type: 'slanted', finder: (h) => h.roof.type !== 'equilateral' };
      return { type: 'anticlockwise' };
    }
    case 9: {
      const isRed = isHouseRedRoof(selectedHouse);
      const isSmall = hasSmallWindow(selectedHouse);
      const expectedClockwise = (lastCorrectPosition + 1) % 4;
      const isClockwise = (selectedHouse.currentPosition === expectedClockwise);
      if (isRed || isClockwise) return { type: 'small_window', finder: (h) => hasSmallWindow(h) };
      if (isSmall) return { type: 'clockwise' };
      return { type: 'small_window', finder: (h) => hasSmallWindow(h) };
    }
    case 10: {
      const hasYellowWalls = isHouseYellowWalls(selectedHouse);
      const has2Crosses = getCrossCount(selectedHouse) === 2;
      const hasRightSlant = selectedHouse.roof.type === 'right';
      if (hasRightSlant) return { type: '2_crosses', finder: (h) => getCrossCount(h) === 2 };
      if (hasYellowWalls || has2Crosses) return { type: 'right_slant', finder: (h) => h.roof.type === 'right' };
      return { type: 'right_slant', finder: (h) => h.roof.type === 'right' };
    }
    case 11: {
      const hasBlueWalls = isHouseBlueWalls(selectedHouse);
      const hasOrangeWindowsLocal = hasOrangeWindows(selectedHouse);
      const hasOppositeCross = isCrossOppositeToSlant(selectedHouse);
      if (hasOppositeCross) return { type: 'orange_windows', finder: (h) => hasOrangeWindows(h) };
      if (hasBlueWalls || hasOrangeWindowsLocal) return { type: 'opposite_cross', finder: (h) => isCrossOppositeToSlant(h) };
      return { type: 'opposite_cross', finder: (h) => isCrossOppositeToSlant(h) };
    }
    default: return null;
  }
};

const determineResponseHouse = (itemId, phase, houses, currentMove, lastCorrectPosition, phase2Rule) => {
  if (phase === 2 && phase2Rule) {
    if (phase2Rule.type === 'clockwise') {
      const nextPosition = (lastCorrectPosition + 1) % 4;
      return houses.find(h => h.currentPosition === nextPosition);
    } else if (phase2Rule.type === 'anticlockwise') {
      const nextPosition = (lastCorrectPosition - 1 + 4) % 4;
      return houses.find(h => h.currentPosition === nextPosition);
    } else if (phase2Rule.finder) {
      return houses.find(h => phase2Rule.finder(h));
    }
    return null;
  }

  // Phase 1 Rules
  switch (itemId) {
    case 1: return houses.find(h => isHouseRedRoof(h));
    case 2: return houses.find(h => h.windows.length === 1);
    case 3: return houses.find(h => h.windows.length === 2);
    case 4: return houses.find(h => h.windows.length === 0);
    case 5:
      if (currentMove === 0) return houses.find(h => h.windows.length === 0);
      const nextPosition = (lastCorrectPosition + 1) % 4;
      return houses.find(h => h.currentPosition === nextPosition);
    case 6: return houses.find(h => isHouseBlueRoof(h) && h.windows.length === 4);
    case 7: return houses.find(h => h.windows.length === 3 && hasSplitWindow(h));
    case 8: return houses.find(h => h.roof.type !== 'equilateral');
    case 9: return houses.find(h => isHouseRedRoof(h));
    case 10: return houses.find(h => isHouseYellowWalls(h) && getCrossCount(h) === 2 && h.roof.type === 'right');
    case 11: return houses.find(h => isHouseBlueWalls(h) && isCrossOppositeToSlant(h) && hasOrangeWindows(h));
    default: return null;
  }
};

const calculateScore = (itemData, moves, trial = 1) => {
  const table = itemData.hasTrials ? (trial === 1 ? itemData.scoring.trial1 : itemData.scoring.trial2) : itemData.scoring;
  for (let entry of table) {
    if (entry.moves && entry.moves === moves) return entry.score;
    if (entry.minMoves && entry.maxMoves && moves >= entry.minMoves && moves <= entry.maxMoves) return entry.score;
  }
  return 0;
};

// =========================
// REACT SUB-COMPONENTS
// =========================
const House = ({ house, onClick, interactionLocked }) => {
  const { currentPosition, roof, base, windows, animationClass } = house;
  
  return (
    <div className={`chor-house position-${currentPosition} ${animationClass || ''}`} onClick={() => !interactionLocked && onClick(house)}>
      <div className={`chor-house-roof type-${roof.type}`}>
        <div 
          className={`chor-roof-triangle roof-type-${roof.type}`} 
          style={{ borderBottomColor: rgbToString(roof.color) }}
        ></div>
        {(roof.crosses || []).map((side, i) => (
          <div key={i} className={`chor-roof-cross cross-${side}`} style={{ color: 'white' }}></div>
        ))}
      </div>
      <div className="chor-house-base" style={{ background: rgbToString(base.color) }}>
        {windows.map((w, i) => (
          <div 
            key={i} 
            className={`chor-house-window chor-window-${w.position} ${w.type === 'small' ? 'window-small' : ''} ${w.type === 'split' ? 'window-split' : ''} ${w.type === 'split-horizontal' ? 'window-split-horizontal' : ''}`}
            style={w.color ? { background: rgbToColor(w.color, 0.6) } : {}}
          ></div>
        ))}
      </div>
    </div>
  );
};

const ChorMachayeShorGame = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Child / Session Data
  const [childData, setChildData] = useState(null);
  const [gameSessionId, setGameSessionId] = useState(null);
  
  // App State
  const [screen, setScreen] = useState('splash'); // splash, game, results
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingResumeData, setPendingResumeData] = useState(null);
  const [quitReason, setQuitReason] = useState('');
  
  // Game State
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [currentTrial, setCurrentTrial] = useState(1);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [currentMove, setCurrentMove] = useState(0);
  const [correctTouchCount, setCorrectTouchCount] = useState(0);
  const [isRuleSelection, setIsRuleSelection] = useState(false);
  const [phase2Rule, setPhase2Rule] = useState(null);
  const [lastCorrectPosition, setLastCorrectPosition] = useState(null);
  
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [currentAttempts, setCurrentAttempts] = useState([]);
  const [itemResults, setItemResults] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  
  const [currentMistakes, setCurrentMistakes] = useState(0);
  const [currentConsecutiveBreaks, setCurrentConsecutiveBreaks] = useState(0);
  const [phase1TimeTaken, setPhase1TimeTaken] = useState(0);
  
  // UI State
  const [houses, setHouses] = useState([]);
  const [interactionLocked, setInteractionLocked] = useState(false);
  const [feedback, setFeedback] = useState(null); // { message, type }
  const [treasurePos, setTreasurePos] = useState(null);
  const [phaseLabel, setPhaseLabel] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [showGrid, setShowGrid] = useState(false);
  
  // Assessment
  const [assessment, setAssessment] = useState({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);

  const timerRef = useRef(null);
  const audioRef = useRef(null);
  
  // Load User
  useEffect(() => {
    const data = localStorage.getItem('currentChild');
    if (data) {
      const parsed = JSON.parse(data);
      setChildData(parsed);
      checkSession(parsed.child_id);
    } else {
      navigate('/login');
    }
  }, []);

  const checkSession = async (childId) => {
    try {
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${API_URL}/games/sessions/resume/${childId}/${GAME_NAME}`, config);
      if (res.data.success && res.data.sessionInfo) {
        const info = res.data.sessionInfo;
        setGameSessionId(info.id);
        if (info.status === 'paused' && info.saved_state) {
          setPendingResumeData(info.saved_state);
          setShowResumeModal(true);
        } else {
          startNewSession(childId);
        }
      } else {
        startNewSession(childId);
      }
    } catch (e) {
      console.error('Resume check failed', e);
      startNewSession(childId);
    }
  };

  const startNewSession = async (childId) => {
    try {
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      const res = await axios.post(`${API_URL}/games/sessions/start`, {
        child_id: childId,
        game_name: GAME_NAME,
        total_questions: TOTAL_QUESTIONS,
      }, config);
      setGameSessionId(res.data.sessionId);
      
      setTimeout(() => {
        saveToServer('in_progress', []);
      }, 500);
    } catch (e) {
      console.error('Failed to start session', e);
    }
  };

  const saveToServer = async (statusOverride, customResults = null, customQuitReason = null) => {
    if (!gameSessionId) return;
    try {
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      const scoresToSave = customResults || itemResults;
      const finalScore = scoresToSave.reduce((acc, r) => acc + r.score, 0);
      
      await axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
        score: finalScore,
        progress_level: scoresToSave.length,
        status: statusOverride || 'in_progress',
        quit_reason: customQuitReason !== null ? customQuitReason : quitReason,
        saved_state: {
          itemResults: scoresToSave,
          currentItemIndex, currentTrial, currentPhase, currentMove, correctTouchCount,
          isRuleSelection, phase2Rule, lastCorrectPosition, timerSeconds,
          currentAttempts, totalScore: finalScore, screen
        }
      }, config);
    } catch (e) { console.error('Save error', e); }
  };

  const resetGameState = () => {
    setItemResults([]);
    setCurrentItemIndex(0);
    setCurrentTrial(1);
    setCurrentPhase(1);
    setCurrentMove(0);
    setCorrectTouchCount(0);
    setIsRuleSelection(false);
    setPhase2Rule(null);
    setLastCorrectPosition(null);
    setTimerSeconds(0);
    setCurrentAttempts([]);
    setTotalScore(0);
    setInteractionLocked(false);
    setFeedback(null);
    setQuitReason('');
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
    setAssessmentSubmitted(false);
  };

  const handleRestart = async () => {
    resetGameState();
    setShowResumeModal(false);
    setScreen('splash');
    if (childData?.child_id) {
      await startNewSession(childData.child_id);
    }
  };

  const resumeGame = () => {
    if (!pendingResumeData) return;
    const ss = pendingResumeData;
    
    // 1. Restore all states
    setItemResults(ss.itemResults || []);
    setCurrentItemIndex(ss.currentItemIndex || 0);
    setCurrentTrial(ss.currentTrial || 1);
    setCurrentPhase(ss.currentPhase || 1);
    setCurrentMove(ss.currentMove || 0);
    setCorrectTouchCount(ss.correctTouchCount || 0);
    setIsRuleSelection(ss.isRuleSelection || false);
    setPhase2Rule(ss.phase2Rule || null);
    setLastCorrectPosition(ss.lastCorrectPosition !== undefined ? ss.lastCorrectPosition : null);
    setTimerSeconds(ss.timerSeconds || 0);
    setCurrentAttempts(ss.currentAttempts || []);
    setTotalScore(ss.totalScore || 0);
    
    const targetScreen = ss.screen || 'splash';
    setScreen(targetScreen);
    setShowResumeModal(false);
    
    // 2. If resuming into game, initialize houses and timer
    if (targetScreen === 'game') {
      startTimer();
      generateAndSetHouses(
        ss.currentItemIndex || 0,
        ss.currentMove || 0,
        ss.currentPhase || 1,
        ss.lastCorrectPosition !== undefined ? ss.lastCorrectPosition : null,
        ss.isRuleSelection || false,
        ss.phase2Rule || null
      );
    }
  };

  const startGame = () => {
    setScreen('game');
    startItem(currentItemIndex); // Start from wherever we are
  };

  const playAudio = useCallback((file) => {
    if (audioRef.current) { audioRef.current.pause(); }
    return new Promise((resolve) => {
      const audio = new Audio(`${AUDIO_DIR}/${file}`);
      audioRef.current = audio;
      
      const fallback = setTimeout(() => resolve(), 3000);
      const safeResolve = () => { clearTimeout(fallback); resolve(); };
      
      audio.onended = safeResolve;
      audio.onerror = safeResolve;
      audio.play().catch(() => safeResolve());
    });
  }, []);

  const showFeedbackMsg = (message, type) => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 2000);
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startItem = (itemIdx) => {
    setCurrentItemIndex(itemIdx);
    setCurrentPhase(1);
    setCurrentTrial(1);
    setCurrentMove(0);
    setCorrectTouchCount(0);
    setIsRuleSelection(false);
    setPhase2Rule(null);
    setLastCorrectPosition(null);
    setCurrentAttempts([]);
    setTimerSeconds(0);
    setPhase1TimeTaken(0);
    setCurrentMistakes(0);
    setCurrentConsecutiveBreaks(0);
    setInteractionLocked(false);
    setPhaseLabel('');
    setTargetLabel('');
    
    startTimer();
    generateAndSetHouses(itemIdx, 0, 1, null, false, null);
  };

  const getCurrentItem = (idx = currentItemIndex) => {
    if (idx < 0 || idx >= GAME_DATA.items.length) return GAME_DATA.items[0];
    return GAME_DATA.items[idx];
  };
  
  const getMaxAttempts = () => {
    const item = getCurrentItem();
    if (!item) return 10;
    if (item.hasTrials) return currentTrial === 1 ? item.maxAttemptsTrial1 : item.maxAttemptsTrial2;
    return item.maxAttempts || 10;
  };

  const getConsecutiveRequired = () => {
    const item = getCurrentItem();
    if (Array.isArray(item.consecutiveRequired)) return item.consecutiveRequired[currentPhase - 1];
    return item.consecutiveRequired;
  };

  const generateAndSetHouses = (itemIdx, move, phase, lastCorrPos, isRuleSel, p2Rule) => {
    const itemData = GAME_DATA.items[itemIdx];
    let newHouses = JSON.parse(JSON.stringify(itemData.houses)); // deep copy base

    // For items > 1, we apply dynamic properties
    if (itemIdx === 1) applyItem2Dynamic(newHouses, move);
    else if (itemIdx === 2) applyItem3Dynamic(newHouses, move);
    else if (itemIdx === 3) applyItem4Dynamic(newHouses);
    else if (itemIdx === 4) applyItem5Dynamic(newHouses);
    else if (itemIdx === 5) applyItem6Dynamic(newHouses, phase, isRuleSel);
    else if (itemIdx === 6) applyItem7Dynamic(newHouses, phase, isRuleSel);
    else if (itemIdx === 7) applyItem8Dynamic(newHouses, phase, move, lastCorrPos, isRuleSel);
    else if (itemIdx === 8) applyItem9Dynamic(newHouses, phase, move, lastCorrPos, isRuleSel);
    else if (itemIdx === 9) applyItem10Dynamic(newHouses, phase, isRuleSel);
    else if (itemIdx === 10) applyItem11Dynamic(newHouses, phase, isRuleSel);

    // Shuffle positions unless it's items where position logic is very specific (4, 7, 8 in original code)
    if (itemIdx !== 4 && itemIdx !== 7 && itemIdx !== 8) {
      const positions = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      newHouses.forEach((h, i) => h.currentPosition = positions[i]);
    } else {
      newHouses.forEach((h, i) => h.currentPosition = i);
    }

    // Determine Response House
    newHouses.forEach(h => h.isResponseHouse = false);
    const responseHouse = determineResponseHouse(itemData.id, phase, newHouses, move, lastCorrPos, p2Rule);
    if (responseHouse) {
      const target = newHouses.find(h => h.currentPosition === responseHouse.currentPosition);
      if (target) target.isResponseHouse = true;
    }

    setHouses(newHouses);
  };

  // --- Dynamic property appliers ---
  const applyItem2Dynamic = (hs, move) => {
    const indices = [0, 1, 2, 3];
    const redIndex = indices[Math.floor(Math.random() * indices.length)];
    let winIdx = move === 0 ? indices.filter(i => i !== redIndex)[Math.floor(Math.random() * 3)] : indices[Math.floor(Math.random() * 4)];
    hs.forEach((h, i) => {
      h.roof.color = i === redIndex ? { r: 249, g: 37, b: 0 } : { r: 255, g: 251, b: 0 };
      h.windows = i === winIdx ? [{ position: 'tl', type: 'normal' }] : [];
    });
  };
  const applyItem3Dynamic = (hs, move) => {
    const redIndex = Math.floor(Math.random() * 4);
    let counts = [0, 0, 0, 0];
    if (move === 0) {
      counts[redIndex] = 1;
      const others = [0,1,2,3].filter(i => i !== redIndex).sort(() => Math.random() - 0.5);
      counts[others[0]] = 1; counts[others[1]] = 2; counts[others[2]] = 0;
    } else {
      counts = [1, 1, 2, 0].sort(() => Math.random() - 0.5);
    }
    hs.forEach((h, i) => {
      h.roof.color = i === redIndex ? { r: 249, g: 37, b: 0 } : { r: 255, g: 251, b: 0 };
      h.windows = counts[i] === 1 ? [{ position: 'tl', type: 'normal' }] : counts[i] === 2 ? [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] : [];
    });
  };
  const applyItem4Dynamic = (hs) => {
    const redIndex = Math.floor(Math.random() * 4);
    const counts = [1, 1, 2, 0].sort(() => Math.random() - 0.5);
    hs.forEach((h, i) => {
      h.roof.color = i === redIndex ? { r: 249, g: 37, b: 0 } : { r: 255, g: 251, b: 0 };
      h.windows = counts[i] === 1 ? [{ position: 'tl', type: 'normal' }] : counts[i] === 2 ? [{ position: 'tl', type: 'normal' }, { position: 'tr', type: 'normal' }] : [];
    });
  };
  const applyItem5Dynamic = (hs) => applyItem4Dynamic(hs);
  const applyItem6Dynamic = (hs, phase, isRuleSel) => {
    const roofs = ['red', 'blue', 'yellow', 'yellow'].sort(() => Math.random() - 0.5);
    const wins = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
    if (phase === 1) {
      const bIdx = roofs.indexOf('blue'); const fIdx = wins.indexOf(4);
      [wins[bIdx], wins[fIdx]] = [wins[fIdx], wins[bIdx]];
    } else if (isRuleSel) {
      const bIdx = roofs.indexOf('blue'); const fIdx = wins.indexOf(4);
      if (bIdx === fIdx) { const o = (fIdx + 1) % 4; [wins[bIdx], wins[o]] = [wins[o], wins[bIdx]]; }
    }
    hs.forEach((h, i) => {
      h.roof.color = roofs[i] === 'red' ? {r:249,g:37,b:0} : roofs[i] === 'blue' ? {r:32,g:53,b:251} : {r:255,g:251,b:0};
      const c = wins[i];
      h.windows = c > 0 ? [{position:'tl',type:'normal'}] : [];
      if(c>1) h.windows.push({position:'tr',type:'normal'});
      if(c>2) h.windows.push({position:'bl',type:'normal'});
      if(c>3) h.windows.push({position:'br',type:'normal'});
    });
  };
  const applyItem7Dynamic = (hs, phase, isRuleSel) => {
    const roofs = ['red', 'yellow', 'yellow', 'yellow'].sort(() => Math.random() - 0.5);
    const wins = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
    let sIdx = -1;
    if (phase === 1) sIdx = wins.indexOf(3);
    else if (isRuleSel) sIdx = [0,1,2,3].filter(i => i !== wins.indexOf(3))[Math.floor(Math.random() * 3)];
    else sIdx = Math.floor(Math.random() * 4);
    
    hs.forEach((h, i) => {
      h.roof.color = roofs[i] === 'red' ? {r:249,g:37,b:0} : {r:255,g:251,b:0};
      const c = wins[i]; const isS = (i === sIdx);
      h.windows = c > 0 ? [{position:'tl',type: isS ? 'split' : 'normal'}] : [];
      if(c>1) h.windows.push({position:'tr',type: isS ? 'split' : 'normal'});
      if(c>2) h.windows.push({position:'bl',type: isS ? 'split' : 'normal'});
      if(c>3) h.windows.push({position:'br',type: isS ? 'split' : 'normal'});
    });
  };
  const applyItem8Dynamic = (hs, phase, move, lastCorr, isRuleSel) => {
    const roofs = ['red', 'yellow', 'yellow', 'yellow'].sort(() => Math.random() - 0.5);
    let sPos = -1;
    if (phase === 1) sPos = (move === 0 || lastCorr === null) ? 2 : (lastCorr - 1 + 4) % 4;
    else if (isRuleSel) {
      const exp = (lastCorr - 1 + 4) % 4;
      sPos = [0,1,2,3].filter(p => p !== exp)[Math.floor(Math.random()*3)];
    } else sPos = Math.floor(Math.random()*4);
    
    const spWin = Math.floor(Math.random()*4);
    hs.forEach((h, i) => {
      h.roof.color = roofs[i] === 'red' ? {r:249,g:37,b:0} : {r:255,g:251,b:0};
      h.roof.type = i === sPos ? 'right' : 'equilateral';
      h.windows = [{position:'tl',type:'normal'}, {position:'tr',type: i===spWin?'split':'normal'}];
    });
  };
  const applyItem9Dynamic = (hs, phase, move, lastCorr, isRuleSel) => {
    let rPos = -1; let sWinPos = -1;
    if (phase === 1) {
      rPos = (move===0||lastCorr===null) ? 0 : (lastCorr + 1) % 4;
      sWinPos = rPos;
    } else if (isRuleSel) {
      const exp = (lastCorr + 1) % 4;
      rPos = [0,1,2,3].filter(p => p !== exp)[Math.floor(Math.random()*3)];
      sWinPos = [0,1,2,3].filter(p => p !== rPos)[Math.floor(Math.random()*3)];
    } else {
      rPos = Math.floor(Math.random()*4); sWinPos = Math.floor(Math.random()*4);
    }
    const bPos = [0,1,2,3].filter(p => p !== rPos)[Math.floor(Math.random()*3)];
    hs.forEach((h, i) => {
      h.roof.color = i===rPos ? {r:249,g:37,b:0} : i===bPos ? {r:32,g:53,b:251} : {r:255,g:251,b:0};
      h.windows = [{position:'tl',type:'normal'}, {position:'tr',type: i===sWinPos?'small':'normal'}];
    });
  };
  const applyItem10Dynamic = (hs, phase, isRuleSel) => {
    const walls = [{r:249,g:37,b:0},{r:255,g:251,b:0},{r:32,g:53,b:251},{r:34,g:139,b:34}].sort(()=>Math.random()-0.5);
    const yIdx = walls.findIndex(c=>c.r===255&&c.g===251);
    let rSlant = -1; let tCross = -1;
    if(phase===1){ rSlant=yIdx; tCross=yIdx; }
    else if(isRuleSel){
      const nonY = [0,1,2,3].filter(i=>i!==yIdx); rSlant = nonY[Math.floor(Math.random()*3)];
      tCross = nonY.filter(i=>i!==rSlant)[Math.floor(Math.random()*2)];
    } else { rSlant=Math.floor(Math.random()*4); tCross=Math.floor(Math.random()*4); }
    
    hs.forEach((h, i) => {
      h.roof.color = Math.random()>0.5 ? {r:249,g:37,b:0}:{r:255,g:251,b:0};
      h.roof.type = i===rSlant ? 'right':'left';
      h.roof.crosses = i===tCross ? ['left','right'] : ['left'];
      h.base.color = walls[i];
      h.windows = [{position:'tl',type:'normal'},{position:'tr',type:'normal'}];
    });
  };
  const applyItem11Dynamic = (hs, phase, isRuleSel) => {
    const walls = [{r:249,g:37,b:0},{r:255,g:251,b:0},{r:32,g:53,b:251},{r:34,g:139,b:34}].sort(()=>Math.random()-0.5);
    const bIdx = walls.findIndex(c=>c.b===251&&c.r===32);
    let oWin = -1; let cOpp = -1;
    if(phase===1){ oWin=bIdx; cOpp=bIdx; }
    else if(isRuleSel){
      const nonB = [0,1,2,3].filter(i=>i!==bIdx); oWin = nonB[Math.floor(Math.random()*3)];
      cOpp = nonB.filter(i=>i!==oWin)[Math.floor(Math.random()*2)];
    } else { oWin=Math.floor(Math.random()*4); cOpp=Math.floor(Math.random()*4); }
    
    hs.forEach((h, i) => {
      const isR = Math.random()>0.5;
      h.roof.type = isR ? 'right':'left';
      h.roof.color = Math.random()>0.5 ? {r:249,g:37,b:0}:{r:255,g:251,b:0};
      h.roof.crosses = i===cOpp ? (isR?['left']:['right']) : (isR?['right']:['left']);
      h.base.color = walls[i];
      const wCol = i===oWin ? {r:255,g:127,b:80} : {r:135,g:206,b:235};
      h.windows = [{position:'tl',type:'normal',color:wCol},{position:'tr',type:'normal',color:wCol}];
    });
  };


  // --- Interactions ---
  const handleHouseClick = async (house) => {
    if (interactionLocked || isPaused) return;
    setInteractionLocked(true);
    
    const isCorrect = house.isResponseHouse;
    
    // Record Attempt
    const newMoveCount = currentMove + 1;
    setCurrentMove(newMoveCount);
    setCurrentAttempts(prev => [...prev, { move: prev.length, trial: currentTrial, phase: currentPhase, timeTaken: timerSeconds, selectedHouse: house.currentPosition, isCorrect: isCorrect ? 1 : 0 }]);

    if (isRuleSelection) {
      const newRule = determinePhase2Rule(getCurrentItem().id, house, lastCorrectPosition);
      setPhase2Rule(newRule);
      setIsRuleSelection(false);
      setCorrectTouchCount(0);
      
      showFeedbackMsg('👀 Something has changed...', 'incorrect');
      await new Promise(r => setTimeout(r, 1500));
      
      // Update correct house highlight logic
      setHouses(prev => {
        const h2 = JSON.parse(JSON.stringify(prev));
        h2.forEach(h => h.isResponseHouse = false);
        const resH = determineResponseHouse(getCurrentItem().id, 2, h2, newMoveCount, lastCorrectPosition, newRule);
        if (resH) {
          const target = h2.find(h => h.currentPosition === resH.currentPosition);
          if (target) target.isResponseHouse = true;
        }
        return h2;
      });

      setHouses(prev => prev.map(h => {
        if (h.currentPosition === house.currentPosition) return { ...h, animationClass: 'wrong-response' };
        if (h.isResponseHouse) return { ...h, animationClass: 'highlight-blur' };
        return h;
      }));
      
      await playAudio('cm_neglect.wav');
      
      setHouses(prev => prev.map(h => h.isResponseHouse ? { ...h, animationClass: 'highlight-sharp' } : { ...h, animationClass: '' }));
      await new Promise(r => setTimeout(r, 800));
      setHouses(prev => prev.map(h => ({ ...h, animationClass: '' })));
      
      await shuffleHouses(newMoveCount, 2, lastCorrectPosition, false, newRule);
      setInteractionLocked(false);
      return;
    }

    if (isCorrect) {
      await handleCorrectAction(house, newMoveCount);
    } else {
      await handleIncorrectAction(house, newMoveCount);
    }
  };

  const handleCorrectAction = async (house, newMoveCount) => {
    const newCorrect = correctTouchCount + 1;
    setCorrectTouchCount(newCorrect);
    setLastCorrectPosition(house.currentPosition);
    
    // Animate correct
    setHouses(prev => prev.map(h => h.currentPosition === house.currentPosition ? { ...h, animationClass: 'correct-response' } : h));
    setTreasurePos(house.currentPosition);
    showFeedbackMsg('✔ Correct!', 'correct');
    await playAudio('cm_appalause.wav');
    await new Promise(r => setTimeout(r, 500));
    setTreasurePos(null);
    setHouses(prev => prev.map(h => ({ ...h, animationClass: '' })));

    const item = getCurrentItem();
    const consecutiveRequiredLocal = Array.isArray(item.consecutiveRequired) ? item.consecutiveRequired[currentPhase - 1] : item.consecutiveRequired;
    
    if (newCorrect >= consecutiveRequiredLocal) {
      await handleMilestone(item);
    } else if (currentAttempts.length + 1 >= getMaxAttempts()) {
      await handleMaxAttempts(item, newMoveCount);
    } else {
      await shuffleHouses(newMoveCount, currentPhase, house.currentPosition, isRuleSelection, phase2Rule);
      setInteractionLocked(false);
    }
  };

  const handleIncorrectAction = async (house, newMoveCount) => {
    if (correctTouchCount > 0) setCurrentConsecutiveBreaks(prev => prev + 1);
    setCorrectTouchCount(0);
    setCurrentMistakes(prev => prev + 1);
    
    // Animate incorrect
    setHouses(prev => prev.map(h => {
      if (h.currentPosition === house.currentPosition) return { ...h, animationClass: 'wrong-response' };
      if (h.isResponseHouse) return { ...h, animationClass: 'highlight-blur' };
      return h;
    }));
    showFeedbackMsg('✖ Try again. Observe carefully.', 'incorrect');
    await playAudio('cm_neglect.wav');
    setHouses(prev => prev.map(h => h.isResponseHouse ? { ...h, animationClass: 'highlight-sharp' } : { ...h, animationClass: '' }));
    await new Promise(r => setTimeout(r, 800));
    setHouses(prev => prev.map(h => ({ ...h, animationClass: '' })));

    const item = getCurrentItem();
    if (currentAttempts.length + 1 >= getMaxAttempts()) {
      await handleMaxAttempts(item, newMoveCount);
    } else {
      await shuffleHouses(newMoveCount, currentPhase, lastCorrectPosition, isRuleSelection, phase2Rule);
      setInteractionLocked(false);
    }
  };

  const handleMilestone = async (item) => {
    if (currentPhase < item.maxPhases) {
      setPhase1TimeTaken(timerSeconds);
      const nextPhase = currentPhase + 1;
      setCurrentPhase(nextPhase);
      setCorrectTouchCount(0);
      setIsRuleSelection(true);
      
      showFeedbackMsg('✅ Great! You found the pattern', 'correct');
      setPhaseLabel(`Phase ${nextPhase}: Rule Changed`);
      setTargetLabel(`Phase ${nextPhase} Target: ${Array.isArray(item.consecutiveRequired) ? item.consecutiveRequired[nextPhase - 1] : item.consecutiveRequired} Correct in a row`);
      await new Promise(r => setTimeout(r, 2000));
      await shuffleHouses(currentMove, nextPhase, lastCorrectPosition, true, phase2Rule);
      setInteractionLocked(false);
    } else {
      if (item.id === 1 && currentTrial === 1) {
        stopTimer();
        const score = calculateScore(item, currentAttempts.length + 1, 1);
        const result = { itemId: item.id, itemName: item.name + ' (Trial 1)', score, moves: currentAttempts.length + 1, timeTaken: timerSeconds, completed: true, trial: 1 };
        const newResults = [...itemResults, result];
        setItemResults(newResults);
        setTotalScore(prev => prev + score);
        
        saveToServer('in_progress', newResults);
        showFeedbackMsg('🎊 Thief Caught!', 'correct');
        await playAudio('cm_thief_caught.wav');
        await new Promise(r => setTimeout(r, 500));
        
        // Wait for user to click Next for trial 2
      } else {
        await finalizeItem(true);
      }
    }
  };

  const handleMaxAttempts = async (item, movesCount) => {
    if (item.id === 1 && currentTrial === 1) {
      stopTimer();
      const result = { itemId: item.id, itemName: item.name + ' (Trial 1)', score: 0, moves: movesCount, timeTaken: timerSeconds, completed: false, trial: 1 };
      const newResults = [...itemResults, result];
      setItemResults(newResults);
      saveToServer('in_progress', newResults);
      // Wait for Next
    } else {
      await finalizeItem(false);
    }
  };

  const finalizeItem = async (success) => {
    stopTimer();
    const item = getCurrentItem();
    const moves = currentAttempts.length + 1;
    const score = success ? calculateScore(item, moves, currentTrial) : 0;
    
    const result = {
      itemId: item.id,
      itemName: item.hasTrials ? `${item.name} (Trial ${currentTrial})` : item.name,
      score, moves, timeTaken: timerSeconds, completed: success,
      phase1Time: phase1TimeTaken > 0 ? phase1TimeTaken : timerSeconds,
      phase2Time: phase1TimeTaken > 0 ? (timerSeconds - phase1TimeTaken) : 0,
      mistakes: currentMistakes, consecutiveBreaks: currentConsecutiveBreaks,
      finalRule: phase2Rule ? phase2Rule.type : null
    };
    
    const newResults = [...itemResults, result];
    setItemResults(newResults);
    setTotalScore(prev => prev + score);
    
    saveToServer(currentItemIndex === TOTAL_QUESTIONS - 1 ? 'completed' : 'in_progress', newResults);
    
    if (success) {
      showFeedbackMsg('🎊 Thief Caught!', 'correct');
      await playAudio('cm_thief_caught.wav');
      await new Promise(r => setTimeout(r, 500));
    }
    // Wait for Next click
  };

  const shuffleHouses = async (move, phase, lastCorr, isRuleSel, p2Rule) => {
    setHouses(prev => prev.map(h => ({ ...h, animationClass: 'shuffling' })));
    await new Promise(r => setTimeout(r, 250));
    generateAndSetHouses(currentItemIndex, move, phase, lastCorr, isRuleSel, p2Rule);
    await new Promise(r => setTimeout(r, 250));
    setHouses(prev => prev.map(h => ({ ...h, animationClass: '' })));
  };

  const handleNextClick = () => {
    if (currentItemIndex === 0 && currentTrial === 1) {
      startTrial2();
    } else if (currentItemIndex + 1 >= TOTAL_QUESTIONS) {
      setScreen('results');
    } else {
      startItem(currentItemIndex + 1);
    }
  };

  const startTrial2 = async () => {
    setCurrentTrial(2);
    setCorrectTouchCount(0);
    setCurrentMove(0);
    setLastCorrectPosition(null);
    setCurrentAttempts([]);
    setTimerSeconds(0);
    setInteractionLocked(true);
    
    showFeedbackMsg('🔄 Trial 2', 'correct');
    await new Promise(r => setTimeout(r, 2000));
    startTimer();
    await shuffleHouses(0, 1, null, false, null);
    setInteractionLocked(false);
  };

  const handleRetake = async () => {
    if (interactionLocked || isPaused) return;
    if (!window.confirm(`Restart Trial ${currentTrial}?`)) return;
    
    setInteractionLocked(true);
    setCorrectTouchCount(0);
    setCurrentMove(0);
    setLastCorrectPosition(null);
    setCurrentAttempts([]);
    setTimerSeconds(0);
    startTimer();
    
    await shuffleHouses(0, currentPhase, null, false, phase2Rule);
    setInteractionLocked(false);
  };

  const handlePauseClick = () => {
    setIsPaused(true);
    setShowPauseModal(true);
    stopTimer();
  };

  const handlePauseAction = async (actionStatus) => {
    if (!quitReason.trim()) { alert('Please provide a reason.'); return; }
    if (actionStatus === 'quit') {
      await saveToServer('in_progress');
      setShowPauseModal(false); setIsPaused(false);
      setScreen('results');
    } else {
      await saveToServer(actionStatus);
      navigate('/');
    }
  };

  const submitAssessment = async () => {
    setIsAssessmentSubmitting(true);
    try {
      await saveToServer('completed');
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      await axios.post(`${API_URL}/games/assessments`, {
        session_id: gameSessionId,
        child_id: childData.child_id,
        q1_enjoyment: assessment.q1,
        q2_feeling: assessment.q2,
        q3_tiredness: assessment.q3,
        q4_play_again: assessment.q4,
        q5_behaviors: assessment.behaviors,
        additional_notes: (assessment.notes || '') + (quitReason ? `\n[Quit Reason: ${quitReason}]` : ''),
      }, config);
      setAssessmentSubmitted(true);
    } catch (e) {
      console.error(e);
      alert('Failed to save assessment. Please try again.');
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  const toggleRecording = (target) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech Recognition not supported in this browser.'); return; }
    if (isRecording && recordingTarget === target) {
      if (window.activeRecognition) window.activeRecognition.stop();
      setIsRecording(false); setRecordingTarget(null); return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      }
      if (final) {
        if (target === 'notes') setAssessment(p => ({ ...p, notes: p.notes + final }));
        else setQuitReason(p => p + final);
      }
    };
    recognition.onend = () => { setIsRecording(false); setRecordingTarget(null); };
    window.activeRecognition = recognition;
    recognition.start();
    setIsRecording(true); setRecordingTarget(target);
  };

  // --- Renders ---
  if (screen === 'splash') {
    return (
      <div className="chor-body-shell">
        <div className="chor-app">
          <header className="chor-topbar">
            <div className="chor-brand"><div className="chor-brand-icon">ध</div><div>Chor Machaye Shor</div></div>
            <div className="chor-stats">
              <div className="chor-stat-pill"><span className="chor-stat-label">CHILD ID</span><span className="chor-stat-value">{childData?.child_id || '—'}</span></div>
            </div>
          </header>
          <main className="chor-main">
            <div className="chor-screen">
              <div className="chor-card chor-splash-card">
                <div className="chor-splash-image-wrapper">
                  <img src={`${IMG_DIR}/chor_machaye_shor.jpg`} alt="Chor Machaye Shor" className="chor-splash-image" />
                </div>
                <div className="chor-splash-title">Welcome to Chor Machaye Shor</div>
                <div className="chor-splash-subtitle">A thief has hidden treasure in houses. Help the police by finding the treasure!<br/>The thief leaves a clue... can you discover it?</div>
                <div className="chor-splash-footer">
                  <div className="chor-btn-row">
                    <button className="chor-btn chor-btn-primary chor-btn-highlight" onClick={startGame}>Start Assessment</button>
                  </div>
                  <p className="chor-splash-hint">Find the treasure 3 times in a row to catch the thief!</p>
                </div>
              </div>
            </div>
          </main>
        </div>
        {/* Modals */}
        {showResumeModal && (
          <div className="chor-modal-overlay">
            <div className="chor-modal-content">
              <h2>Saved Progress Found</h2>
              <p>You have a previously paused game session. Would you like to resume?</p>
              <div className="modal-actions-row">
                <button className="modal-btn modal-btn-cancel" onClick={handleRestart}>Restart Game</button>
                <button className="modal-btn modal-btn-primary" onClick={resumeGame}>Resume Game</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'results') {
    const attempted = itemResults.length;
    const correctCount = itemResults.filter(r => r.completed).length;
    const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;
    const tTime = itemResults.reduce((acc, r) => acc + r.timeTaken, 0);
    const tMoves = itemResults.reduce((acc, r) => acc + r.moves, 0);
    const avgTime = attempted > 0 ? Math.round(tTime / attempted) : 0;

    return (
      <div className="chor-body-shell">
        <div className="chor-app">
          <header className="chor-topbar">
            <div className="chor-brand"><div className="chor-brand-icon">ध</div><div>Chor Machaye Shor</div></div>
            <div className="chor-stats">
              <div className="chor-stat-pill"><span className="chor-stat-label">TIME</span><span className="chor-stat-value">{String(Math.floor(tTime/60)).padStart(2,'0')}:{String(tTime%60).padStart(2,'0')}</span></div>
              <div className="chor-stat-pill"><span className="chor-stat-label">SP</span><span className="chor-stat-value">{correctCount}</span></div>
              <div className="chor-stat-pill"><span className="chor-stat-label">SCORE</span><span className="chor-stat-value">{totalScore}</span></div>
            </div>
          </header>

          <main className="chor-main" style={{ padding: '24px' }}>
            <div className="chor-dashboard-container">
              {/* Header Section */}
              <div className="chor-dash-header">
                <div>
                  <div className="chor-dash-title">{quitReason ? 'Session Terminated' : 'Assessment Complete'}</div>
                  <div className="chor-dash-subtitle">{quitReason ? 'Assessor requested early exit' : 'Test finished successfully'}</div>
                </div>
                <div className="chor-dash-badges">
                  <span className="chor-chip chor-chip-splash">Final Results</span>
                  <span className="chor-chip chor-chip-game">Time: {Math.floor(tTime / 60)}m {tTime % 60}s</span>
                </div>
              </div>

              <div className="chor-dash-content">
              {/* Performance Section */}
              <div className="chor-dash-section">
                <h3 className="chor-section-title">Performance</h3>
                <p className="chor-section-subtitle">Assessment Completed</p>
                
                <div className="chor-dash-stat-grid">
                  <div className="chor-big-score-circle">
                    <span className="score-value">{totalScore}</span>
                    <span className="score-max">Total Score</span>
                  </div>
                  <div className="chor-stat-boxes">
                    <div className="chor-stat-box"><div className="chor-stat-box-label">Total Score</div><div className="chor-stat-val">{totalScore}</div></div>
                    <div className="chor-stat-box"><div className="chor-stat-box-label">Completed Items</div><div className="chor-stat-val text-green">{attempted}</div></div>
                    <div className="chor-stat-box"><div className="chor-stat-box-label">Total Moves</div><div className="chor-stat-val text-red">{tMoves}</div></div>
                    <div className="chor-stat-box"><div className="chor-stat-box-label">Accuracy</div><div className="chor-stat-val">{accuracy}%</div></div>
                    <div className="chor-stat-box"><div className="chor-stat-box-label">Total Time</div><div className="chor-stat-val">{Math.floor(tTime / 60)}m {tTime % 60}s</div></div>
                    <div className="chor-stat-box chor-stat-box-wide"><div className="chor-stat-box-label">Avg Time/Q</div><div className="chor-stat-val">{avgTime}s</div></div>
                  </div>
                </div>
                
                <div className="chor-banner-success">
                  Excellent work! Keep it up! 🌟
                </div>
              </div>

              {/* Cognitive Insights */}
              <div className="chor-dash-section chor-insights-section">
                <h4 className="chor-insights-title">Cognitive Insights</h4>
                <div className="chor-insights-grid">
                  <div className="chor-insight-item">
                    <strong>Pattern Recognition:</strong> <span className="chor-stars">★★★★☆</span>
                  </div>
                  <div className="chor-insight-item">
                    <strong>Rule Switching:</strong> <span className="chor-stars">★★★★★</span>
                  </div>
                  <div className="chor-insight-item">
                    <strong>Consistency:</strong> Stable
                  </div>
                </div>
                <p className="chor-insight-text">
                  User performed well in visual pattern tasks. Strong cognitive flexibility and rapid adaptation to new rules.
                </p>
              </div>

              {/* Breakdown Accordion */}
              <div className="chor-accordion">
                <button className="chor-accordion-toggle" onClick={() => setShowGrid(!showGrid)}>
                  {showGrid ? '▼' : '▶'} Show per-question results with time
                </button>
                {showGrid && (
                  <div className="chor-q-grid">
                    {itemResults.map((r, i) => (
                      <div key={i} className="chor-q-card">
                        <div className="q-card-top">
                          <span className="q-id">Item {r.itemId}</span>
                          <span className={`q-status ${r.completed ? 'pass' : 'fail'}`}>{r.completed ? '✔' : '✘'}</span>
                        </div>
                        <div className="q-item-name">{r.itemName}</div>
                        <div className="q-stats-row">
                          <span className="q-stat">Score: <strong>{r.score}</strong></span>
                          <span className="q-stat">Moves: <strong>{r.moves}</strong></span>
                          <span className="q-stat">Time: <strong>{r.timeTaken}s</strong></span>
                        </div>
                        {r.phase2Time > 0 && (
                          <div className="q-advanced">
                            <div className="q-adv-title">ADVANCED METRICS</div>
                            <div className="q-adv-phases">
                              <span>Phase 1: {r.phase1Time}s</span>
                              <span>Phase 2: {r.phase2Time}s</span>
                            </div>
                            <div className="q-adv-row">Mistakes: {r.mistakes || 0}</div>
                            <div className="q-adv-row">Rule: <strong>{r.finalRule || 'N/A'}</strong></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assessment Form */}
              <div className="assessment-form-section">
                <h3 className="form-section-title">Clinical Assessment</h3>
                
                {assessmentSubmitted ? (
                  <div className="chor-banner-success" style={{ marginTop: '20px' }}>
                    Assessment submitted successfully!
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">1. Did the child enjoy the game?</label>
                      <div className="radio-group">
                        {['Yes', 'Somewhat', 'No'].map(opt => (
                          <label key={opt} className="radio-item"><input type="radio" name="q1" value={opt} checked={assessment.q1===opt} onChange={e=>setAssessment(p=>({...p,q1:e.target.value}))}/> {opt}</label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">2. How was the child's feeling?</label>
                      <div className="radio-group">
                        {['Happy', 'Neutral', 'Frustrated', 'Sad'].map(opt => (
                          <label key={opt} className="radio-item"><input type="radio" name="q2" value={opt} checked={assessment.q2===opt} onChange={e=>setAssessment(p=>({...p,q2:e.target.value}))}/> {opt}</label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">3. Did the child look tired?</label>
                      <div className="radio-group">
                        {['Yes', 'No'].map(opt => (
                          <label key={opt} className="radio-item"><input type="radio" name="q3" value={opt} checked={assessment.q3===opt} onChange={e=>setAssessment(p=>({...p,q3:e.target.value}))}/> {opt}</label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">4. Did the child want to play again?</label>
                      <div className="radio-group">
                        {['Yes', 'No'].map(opt => (
                          <label key={opt} className="radio-item"><input type="radio" name="q4" value={opt} checked={assessment.q4===opt} onChange={e=>setAssessment(p=>({...p,q4:e.target.value}))}/> {opt}</label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">5. Observe behaviors (Check all that apply)</label>
                      <div className="checkbox-grid">
                        {['Distracted', 'Hyperactive', 'Anxious', 'Impulsive', 'Quiet/Withdrawn', 'Engaged/Focused'].map(opt => (
                          <label key={opt} className="checkbox-item">
                            <input type="checkbox" checked={assessment.behaviors.includes(opt)} onChange={e => {
                              const checked = e.target.checked;
                              setAssessment(p => ({ ...p, behaviors: checked ? [...p.behaviors, opt] : p.behaviors.filter(b => b !== opt) }));
                            }}/> {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{display:'flex',justifyContent:'space-between'}}>
                        Additional Notes
                        <button type="button" className={`mic-btn ${isRecording&&recordingTarget==='notes'?'recording':''}`} onClick={()=>toggleRecording('notes')}>🎤 Dictate</button>
                      </label>
                      <textarea className="form-textarea" placeholder="Add any clinical observations..." value={assessment.notes} onChange={e=>setAssessment(p=>({...p,notes:e.target.value}))}></textarea>
                    </div>
                  </>
                )}

                <div className="final-actions">
                  {assessmentSubmitted ? (
                    <>
                      <button className="chor-btn chor-btn-primary" onClick={() => navigate('/')}>🏠 Go to Home</button>
                      <button className="chor-btn chor-btn-success" onClick={handleRestart}>↻ Restart Game</button>
                    </>
                  ) : (
                    <button className="chor-btn chor-btn-primary" onClick={submitAssessment} disabled={isAssessmentSubmitting}>
                      {isAssessmentSubmitting ? 'Saving...' : 'Save & Exit'}
                    </button>
                  )}
                </div>
              </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // GAME SCREEN
  const currentItem = getCurrentItem();
  const maxAtt = getMaxAttempts();
  const isComplete = currentAttempts.length >= maxAtt || correctTouchCount >= getConsecutiveRequired();
  const canNext = isComplete || (currentItemIndex === 0 && currentTrial === 1 && itemResults.some(r => r.itemId === 1 && r.trial === 1));

  return (
    <div className="chor-body-shell">
      <div className="chor-app">
        <header className="chor-topbar">
          <div className="chor-brand"><div className="chor-brand-icon">ध</div><div>Chor Machaye Shor</div></div>
          <div className="chor-stats">
            <div className="chor-stat-pill"><span className="chor-stat-label">CHILD ID</span><span className="chor-stat-value">{childData?.child_id || '—'}</span></div>
            <div className="chor-stat-pill"><span className="chor-stat-label">TIME</span><span className="chor-stat-value">{Math.floor(timerSeconds/60).toString().padStart(2,'0')}:{(timerSeconds%60).toString().padStart(2,'0')}</span></div>
            <div className="chor-stat-pill"><span className="chor-stat-label">SCORE</span><span className="chor-stat-value">{totalScore}</span></div>
            <button className="chor-btn chor-btn-secondary" style={{padding: '0 12px', height: '34px', fontSize: '0.8rem', minWidth: 'auto', borderRadius: '30px'}} onClick={handlePauseClick}>Pause / Quit</button>
          </div>
        </header>

        <main className="chor-main">
          <div className="chor-screen">
            <div className="chor-screen-header">
              <div>
                <div className="chor-screen-title" style={{display:'flex', gap:'10px', alignItems:'center'}}>
                  {currentItem.name}
                  {phaseLabel && <div className="chor-chip chor-chip-splash">{phaseLabel}</div>}
                </div>
                <div className="chor-screen-subtitle">Move: {currentMove} of {maxAtt}</div>
              </div>
              <div className="chor-chips"><span className="chor-chip chor-chip-game">Playing</span></div>
            </div>

            <div className="chor-progress">
              <span className="chor-progress-label">Consecutive Correct:</span>
              <div className="chor-progress-dots">
                {Array(getConsecutiveRequired()).fill(0).map((_, i) => (
                  <span key={i} className={`chor-dot ${i < correctTouchCount ? 'active' : ''}`}></span>
                ))}
              </div>
            </div>

            {targetLabel && <div style={{textAlign:'center', fontWeight:600, color:'#3b82f6', marginTop:'5px'}}>{targetLabel}</div>}

            <div className="chor-houses-wrapper">
              <div className="chor-houses-container">
                {houses.map((h, i) => (
                  <House key={i} house={h} onClick={handleHouseClick} interactionLocked={interactionLocked} />
                ))}
                {treasurePos !== null && (
                  <div className="chor-treasure-effect" style={{
                    left: treasurePos === 0 || treasurePos === 2 ? '50%' : (treasurePos === 1 ? '100%' : '0%'),
                    top: treasurePos === 0 ? '0%' : (treasurePos === 2 ? '100%' : '50%'),
                    marginLeft: treasurePos === 1 ? '-75px' : (treasurePos === 3 ? '75px' : '0px'),
                    marginTop: treasurePos === 2 ? '-100px' : (treasurePos === 0 ? '100px' : '0px')
                  }}>💎</div>
                )}
              </div>
              {feedback && <div className={`chor-feedback-overlay ${feedback.type} show`}>{feedback.message}</div>}
            </div>

            <div className="chor-btn-row">
              {currentItemIndex === 0 && <button className="chor-btn chor-btn-warning" onClick={handleRetake} disabled={interactionLocked}>Retake</button>}
              <button className="chor-btn chor-btn-success" onClick={handleNextClick} disabled={!canNext}>Next Question</button>
            </div>
          </div>
        </main>
      </div>

      {showPauseModal && (
        <div className="chor-modal-overlay">
          <div className="chor-modal-content">
            <h2>Pause or Quit</h2>
            <p>Session timer is paused. Please provide a reason below.</p>
            <div className="modal-textarea-wrapper">
              <textarea className="modal-textarea" placeholder="E.g., Child is crying, washroom break..." value={quitReason} onChange={(e) => setQuitReason(e.target.value)}></textarea>
              <button className={`modal-mic-btn ${isRecording ? 'recording' : ''}`} onClick={() => toggleRecording('quit')} title="Dictate Reason">🎤</button>
            </div>
            <div className="modal-actions-row">
              <button className="modal-btn modal-btn-cancel" onClick={() => { setShowPauseModal(false); setIsPaused(false); startTimer(); }}>Cancel</button>
              <button className="modal-btn modal-btn-pause" onClick={() => handlePauseAction('paused')}>Pause Session</button>
              <button className="modal-btn modal-btn-quit" onClick={() => handlePauseAction('quit')}>Quit Game</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChorMachayeShorGame;
