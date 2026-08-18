import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage, STT_LANG_MAP } from '../contexts/LanguageContext';
import { useHeaderConfig } from '../contexts/HeaderConfigContext';
import { useTestAudio } from '../hooks/useTestAudio';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import './ChorMachayeShorGame.css';

const formatTime = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const fmtDuration = (sec) => {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
  const h = Math.floor(sec / 3600).toString().padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

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
      id: 6, name: "Item 6: Blue Roof or 4 Windows", maxAttempts: 18, maxPhases: 2, consecutiveRequired: [3, 3],
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
      id: 7, name: "Item 7: 3 Windows or Split", maxAttempts: 18, maxPhases: 2, consecutiveRequired: [3, 3],
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
      id: 8, name: "Item 8: Slanted or Anticlockwise", maxAttempts: 18, maxPhases: 2, consecutiveRequired: [3, 3],
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
      id: 9, name: "Item 9: Red or Clockwise or Small", maxAttempts: 21, maxPhases: 2, consecutiveRequired: [3, 3],
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
      id: 10, name: "Item 10: Yellow or Crosses or Right-Slant", maxAttempts: 21, maxPhases: 2, consecutiveRequired: [3, 3],
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
      id: 11, name: "Item 11: Blue or Opposite or Orange", maxAttempts: 21, maxPhases: 2, consecutiveRequired: [3, 3],
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

const getRuralSolidColor = (rgb) => {
  if (!rgb) return 'rgb(255, 255, 255)';
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
};

const getRuralGradient = (rgb, isWindow = false) => {
  if (!rgb) return isWindow ? 'rgb(135, 206, 235)' : 'rgb(255, 255, 255)';
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
};

// =========================
// REACT SUB-COMPONENTS
// =========================
const House = ({ house, onClick, interactionLocked }) => {
  const { currentPosition, roof, base, windows, animationClass } = house;
  
  return (
    <div className={`chor-house position-${currentPosition} ${animationClass || ''} ${interactionLocked ? 'interaction-locked' : ''}`} onClick={() => !interactionLocked && onClick(house)}>
      <div className={`chor-house-roof type-${roof.type}`}>
        <div 
          className={`chor-roof-triangle roof-type-${roof.type}`} 
          style={{ borderBottomColor: getRuralSolidColor(roof.color) }}
        ></div>
        {(roof.crosses || []).map((side, i) => (
          <div key={i} className={`chor-roof-cross cross-${side}`} style={{ color: 'white' }}></div>
        ))}
      </div>
      <div className="chor-house-base" style={{ background: getRuralGradient(base.color) }}>
        {windows.map((w, i) => (
          <div 
            key={i} 
            className={`chor-house-window chor-window-${w.position} ${w.type === 'small' ? 'window-small' : ''} ${w.type === 'split' ? 'window-split' : ''} ${w.type === 'split-horizontal' ? 'window-split-horizontal' : ''}`}
            style={w.color ? { background: getRuralGradient(w.color, true) } : {}}
          ></div>
        ))}
      </div>
    </div>
  );
};

const ChorMachayeShorGame = () => {
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
  const { showLogo, showGameIcon, showGameName, showChildId, showTimer, showScore } = useHeaderConfig();
  // Elements panel's test_id for this game is 'cognitive_flex_chor' (see
  // testConfigService.js's GAMES_REGISTRY) — distinct from the GAME_NAME
  // constant below, which is only for game-session tracking.
  const { getAudioUrl, ready: audioReady } = useTestAudio('cognitive_flex_chor');
  // Admin-managed per-language audio (Elements -> Audio Management), falling
  // back to the bundled Hindi clips under AUDIO_DIR when nothing's
  // configured yet — resolved fresh at each call site, since playAudio()
  // runs from inside async handlers, not JSX render output.
  const resolveAudio = useCallback((key, file) => getAudioUrl(key, `${AUDIO_DIR}/${file}`), [getAudioUrl]);
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
  const [attemptNo, setAttemptNo] = useState(1);
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
  const itemRetakesRef = useRef({});
  
  const [currentMistakes, setCurrentMistakes] = useState(0);
  const [currentConsecutiveBreaks, setCurrentConsecutiveBreaks] = useState(0);
  const [phase1TimeTaken, setPhase1TimeTaken] = useState(0);
  const [phase1CompletedPending, setPhase1CompletedPending] = useState(false);
  const [nextButtonReady, setNextButtonReady] = useState(false);
  
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
  const [audioFinished, setAudioFinished] = useState(false);

  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  // Dedicated ref for the splash <audio> tag below — kept separate from
  // audioRef, which playAudio() reassigns to a fresh Audio object per clip.
  const splashAudioRef = useRef(null);
  const splashAudioStartedRef = useRef(false); // gate: play audio only once per splash entry

  const [sessionTimerSec, setSessionTimerSec] = useState(0);
  const sessionTimerSecRef = useRef(0);
  const sessionTimerRef = useRef(null);

  // ─── Splash audio: admin-managed per-language, falling back to the
  // bundled Hindi clip — same pattern every other game uses. ──────────────
  useLayoutEffect(() => {
    if (screen === 'splash') {
      setAudioFinished(false);
      splashAudioStartedRef.current = false;
    }
  }, [screen]);

  useEffect(() => {
    if (
      screen === 'splash' &&
      !showResumeModal &&
      !splashAudioStartedRef.current &&
      splashAudioRef.current &&
      !audioFinished &&
      audioReady
    ) {
      splashAudioStartedRef.current = true;
      splashAudioRef.current.load();
      splashAudioRef.current.play().catch(err => {
        console.warn('Splash audio autoplay failed:', err);
      });
    }
  }, [screen, showResumeModal, audioFinished, audioReady]);

  // ─── StatusBar: hide on native during this game ───────────────────────────
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

  // ─── Admin-controlled item activation (Elements panel) ─────────────────────
  // test_id is 'cognitive_flex_chor' (Elements panel's key for this game, see
  // testConfigService.js's GAMES_REGISTRY) — deliberately NOT the GAME_NAME
  // constant above, which is only for game-session tracking. Independent
  // fetch rather than extending useTestAudio (shared by every audio-enabled
  // game and already scoped to audio_-prefixed rows only) — one extra cheap
  // non-blocking GET, isolated, same as Rachna/Mela's own dedicated fetch.
  const [elementOverrides, setElementOverrides] = useState({});
  useEffect(() => {
    axios.get(`${API_URL}/public/elements`, { params: { test_id: 'cognitive_flex_chor' } })
      .then(res => {
        const map = {};
        (res.data.elements || []).forEach(el => { map[el.asset_type] = el; });
        setElementOverrides(map);
      })
      .catch(() => {}); // silent — resolution below just falls through to "active"
  }, []);

  // GAME_DATA.items must NEVER be filtered/reordered — generateAndSetHouses's
  // index-dispatch block below and every applyItemNDynamic/determine*
  // function key off the item's original array position and id.
  // Deactivation is purely a navigation-layer skip over the intact array.
  const isItemActive = (id) => elementOverrides[`item${id}`]?.config?.active !== false;
  const resolveFirstActiveIndex = () => {
    for (let i = 0; i < GAME_DATA.items.length; i++) if (isItemActive(GAME_DATA.items[i].id)) return i;
    return null;
  };
  const resolveNextActiveIndex = (fromIdx) => {
    for (let i = fromIdx + 1; i < GAME_DATA.items.length; i++) if (isItemActive(GAME_DATA.items[i].id)) return i;
    return null;
  };

  useEffect(() => {
    const item = GAME_DATA.items[currentItemIndex];
    if (item && (item.id === 6 || item.id === 7 || item.id === 8 || item.id === 9 || item.id === 10 || item.id === 11) && currentPhase === 1 && correctTouchCount >= 3) {
      setPhase1CompletedPending(true);
      setInteractionLocked(true);
    } else {
      setPhase1CompletedPending(false);
    }
  }, [currentItemIndex, currentPhase, correctTouchCount]);

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

  useEffect(() => {
    const active = (screen === 'game' || screen === 'results') && !assessmentSubmitted;
    if (active) {
      sessionTimerRef.current = setInterval(() => {
        setSessionTimerSec(s => { sessionTimerSecRef.current = s + 1; return s + 1; });
      }, 1000);
    } else {
      clearInterval(sessionTimerRef.current);
    }
    return () => clearInterval(sessionTimerRef.current);
  }, [screen, assessmentSubmitted]);

  const checkSession = async (childId) => {
    try {
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${API_URL}/games/sessions/resume/${childId}/${GAME_NAME}`, config);
      if (res.data.success && res.data.sessionInfo) {
        const info = res.data.sessionInfo;
        setGameSessionId(info.id);
        setAttemptNo(info.attempt_no || 1);
        
        // If it's paused or has saved state, show resume modal
        if (info.status === 'paused' || (info.status === 'in_progress' && info.saved_state)) {
          setPendingResumeData(info.saved_state);
          setShowResumeModal(true);
        } else if (info.status === 'in_progress') {
          // Just use the existing in_progress session without showing modal if no state yet
          // This prevents duplication on refresh at the very start
          console.log("Reusing existing in_progress session", info.id);
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
      setAttemptNo(res.data.attempt_no || 1);
      
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
          currentAttempts, totalScore: finalScore, screen,
          screentime: sessionTimerSecRef.current,
          retakeCount: Object.values(itemRetakesRef.current).reduce((a, b) => a + b, 0),
          itemRetakes: itemRetakesRef.current
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
    setSessionTimerSec(0);
    sessionTimerSecRef.current = 0;
    itemRetakesRef.current = {};
    setCurrentAttempts([]);
    setTotalScore(0);
    setInteractionLocked(false);
    setFeedback(null);
    setQuitReason('');
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
    setAssessmentSubmitted(false);
    setIsPaused(false);
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
    setSessionTimerSec(ss.screentime || 0);
    sessionTimerSecRef.current = ss.screentime || 0;
    itemRetakesRef.current = ss.itemRetakes || {};
    setCurrentAttempts(ss.currentAttempts || []);
    setTotalScore(ss.totalScore || 0);
    
    const targetScreen = ss.screen || 'splash';
    setShowResumeModal(false);

    // 2. If resuming into game, the saved item may have been deactivated by
    // an admin while this session sat paused. GAME_DATA.items is never
    // filtered (generateAndSetHouses' index-dispatch relies on the raw
    // array position), so this can only be resolved at the navigation
    // layer, same as handleNextClick.
    if (targetScreen === 'game') {
      const savedIdx = ss.currentItemIndex || 0;
      const savedItem = GAME_DATA.items[savedIdx];
      const targetIdx = (savedItem && isItemActive(savedItem.id)) ? savedIdx : resolveNextActiveIndex(savedIdx);

      if (targetIdx === null) {
        // Every item from the saved position onward is now inactive — every
        // earlier item is already recorded in ss.itemResults, so there's
        // nothing left to play. End the session gracefully instead of
        // resuming into a now-nonexistent item.
        setScreen('results');
        saveToServer('dropped', ss.itemResults || []);
        return;
      }

      setScreen('game');
      if (targetIdx === savedIdx) {
        // Saved item is still active — resume exactly where it left off.
        startTimer();
        generateAndSetHouses(
          savedIdx,
          ss.currentMove || 0,
          ss.currentPhase || 1,
          ss.lastCorrectPosition !== undefined ? ss.lastCorrectPosition : null,
          ss.isRuleSelection || false,
          ss.phase2Rule || null
        );
      } else {
        // Saved item is now inactive — its saved move/phase/trial progress
        // belongs to an item we're no longer resuming; start the
        // forward-walked item fresh.
        startItem(targetIdx);
      }
      return;
    }

    setScreen(targetScreen);
  };

  const startGame = () => {
    setScreen('game');
    startItem(resolveFirstActiveIndex() ?? 0); // fallback only; backend guard means this is never actually null
  };

  const playAudio = useCallback((url) => {
    if (audioRef.current) { audioRef.current.pause(); }
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      
      const fallback = setTimeout(() => resolve(), 3000);
      const safeResolve = () => { clearTimeout(fallback); resolve(); };
      
      audio.onended = safeResolve;
      audio.onerror = safeResolve;
      audio.play().catch(() => safeResolve());
    });
  }, []);

  const showFeedbackMsg = (message, type, duration = 2000) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
    setFeedback({ message, type });
    if (duration > 0) {
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null);
        feedbackTimeoutRef.current = null;
      }, duration);
    }
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
    setNextButtonReady(false);
    
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
    
    // Assign distinct non-orange window colors to the other 3 houses
    const nonOrangeIndices = [0, 1, 2, 3].filter(idx => idx !== oWin);
    let assignedColors = {};
    const colorsPool = [
      {r:249,g:37,b:0}, // Red
      {r:255,g:251,b:0}, // Yellow
      {r:32,g:53,b:251}, // Blue
      {r:34,g:139,b:34}  // Green
    ];
    colorsPool.sort(() => Math.random() - 0.5);

    const assign = (k) => {
      if (k === nonOrangeIndices.length) return true;
      const idx = nonOrangeIndices[k];
      const wallColor = walls[idx];
      for (let i = 0; i < colorsPool.length; i++) {
        const color = colorsPool[i];
        if (color.used) continue;
        if (!(color.r === wallColor.r && color.g === wallColor.g && color.b === wallColor.b)) {
          color.used = true;
          assignedColors[idx] = color;
          if (assign(k + 1)) return true;
          color.used = false;
        }
      }
      return false;
    };
    assign(0);
    
    hs.forEach((h, i) => {
      const isR = Math.random()>0.5;
      h.roof.type = isR ? 'right':'left';
      h.roof.color = Math.random()>0.5 ? {r:249,g:37,b:0}:{r:255,g:251,b:0};
      h.roof.crosses = i===cOpp ? (isR?['left']:['right']) : (isR?['right']:['left']);
      h.base.color = walls[i];
      const wCol = i===oWin ? {r:255,g:127,b:80} : assignedColors[i];
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
      
      await playAudio(resolveAudio('cm_neglect', 'cm_neglect.wav'));
      
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
    // Visual "✔ Correct!" banner hidden per request — everything else about
    // a correct move (score, animation, treasure icon, applause audio,
    // milestone/attempt-limit progression below) is unchanged.
    await playAudio(resolveAudio('cm_appalause', 'cm_appalause.wav'));
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
    await playAudio(resolveAudio('cm_neglect', 'cm_neglect.wav'));
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
      if (item.id === 6 || item.id === 7 || item.id === 8 || item.id === 9 || item.id === 10 || item.id === 11) {
        return;
      }
      setPhase1TimeTaken(timerSeconds);
      const nextPhase = currentPhase + 1;
      setCurrentPhase(nextPhase);
      setCorrectTouchCount(0);
      setIsRuleSelection(true);
      
      showFeedbackMsg(t('game.foundPattern'), 'correct');
      setPhaseLabel(`Phase ${nextPhase}: Rule Changed`);
      setTargetLabel(`Phase ${nextPhase} Target: ${Array.isArray(item.consecutiveRequired) ? item.consecutiveRequired[nextPhase - 1] : item.consecutiveRequired} Correct in a row`);
      await new Promise(r => setTimeout(r, 2000));
      await shuffleHouses(currentMove, nextPhase, lastCorrectPosition, true, phase2Rule);
      setInteractionLocked(false);
    } else {
      if (item.id === 1 && currentTrial === 1) {
        stopTimer();
        const score = calculateScore(item, currentAttempts.length + 1, 1);
        const result = { itemId: item.id, itemName: item.name + ' (Trial 1)', score, moves: currentAttempts.length + 1, timeTaken: timerSeconds, completed: true, trial: 1, retakes: itemRetakesRef.current[currentItemIndex] || 0 };
        const newResults = [...itemResults, result];
        setItemResults(newResults);
        setTotalScore(prev => prev + score);
        
        saveToServer('in_progress', newResults);
        showFeedbackMsg('🎊 Thief Caught!', 'correct', 0);
        await playAudio(resolveAudio('cm_thief_caught', 'cm_thief_caught.wav'));
        setNextButtonReady(true);
      } else {
        await finalizeItem(true);
      }
    }
  };

  const handleMaxAttempts = async (item, movesCount) => {
    if (item.id === 1 && currentTrial === 1) {
      stopTimer();
      const result = { itemId: item.id, itemName: item.name + ' (Trial 1)', score: 0, moves: movesCount, timeTaken: timerSeconds, completed: false, trial: 1, retakes: itemRetakesRef.current[currentItemIndex] || 0 };
      const newResults = [...itemResults, result];
      setItemResults(newResults);
      saveToServer('in_progress', newResults);
      setNextButtonReady(true);
    } else {
      await finalizeItem(false);
    }
  };

  const checkDropCondition = (results) => {
    const distinctScores = [];
    const seenIds = [];
    for (const r of results) {
      const idx = seenIds.indexOf(r.itemId);
      if (idx === -1) {
        seenIds.push(r.itemId);
        distinctScores.push({ itemId: r.itemId, score: r.score });
      } else {
        distinctScores[idx].score = Math.max(distinctScores[idx].score, r.score);
      }
    }
    if (distinctScores.length < 2) return false;
    const last1 = distinctScores[distinctScores.length - 1];
    const last2 = distinctScores[distinctScores.length - 2];
    return last1.score === 0 && last2.score === 0;
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
      finalRule: phase2Rule ? phase2Rule.type : null,
      trial: currentTrial,
      retakes: itemRetakesRef.current[currentItemIndex] || 0
    };
    
    const newResults = [...itemResults, result];
    setItemResults(newResults);
    setTotalScore(prev => prev + score);
    
    const hasDropped = checkDropCondition(newResults);
    const isLastActiveItem = resolveNextActiveIndex(currentItemIndex) === null;
    const status = (isLastActiveItem || hasDropped) ? 'completed' : 'in_progress';
    saveToServer(status, newResults);
    
    if (hasDropped) {
      showFeedbackMsg('🏁 Assessment Finished', 'correct', 0);
      setInteractionLocked(true);
      setNextButtonReady(true);
    } else if (success) {
      showFeedbackMsg('🎊 Thief Caught!', 'correct', 0);
      await playAudio(resolveAudio('cm_thief_caught', 'cm_thief_caught.wav'));
      setNextButtonReady(true);
    } else {
      setNextButtonReady(true);
    }
  };

  const handlePhase2Transition = async () => {
    if (!phase1CompletedPending) return;
    setPhase1CompletedPending(false);
    setInteractionLocked(false);
    
    const item = getCurrentItem();
    setPhase1TimeTaken(timerSeconds);
    const nextPhase = currentPhase + 1;
    setCurrentPhase(nextPhase);
    setCorrectTouchCount(0);
    setIsRuleSelection(true);
    
    showFeedbackMsg(t('game.foundPattern'), 'correct');
    setPhaseLabel(`Phase ${nextPhase}: Rule Changed`);
    setTargetLabel(`Phase ${nextPhase} Target: ${Array.isArray(item.consecutiveRequired) ? item.consecutiveRequired[nextPhase - 1] : item.consecutiveRequired} Correct in a row`);
    
    await new Promise(r => setTimeout(r, 2000));
    await shuffleHouses(currentMove, nextPhase, lastCorrectPosition, true, phase2Rule);
    setInteractionLocked(false);
  };

  const shuffleHouses = async (move, phase, lastCorr, isRuleSel, p2Rule) => {
    setHouses(prev => prev.map(h => ({ ...h, animationClass: 'shuffling' })));
    await new Promise(r => setTimeout(r, 250));
    generateAndSetHouses(currentItemIndex, move, phase, lastCorr, isRuleSel, p2Rule);
    await new Promise(r => setTimeout(r, 250));
    setHouses(prev => prev.map(h => ({ ...h, animationClass: '' })));
  };

  const handleNextClick = () => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
    setFeedback(null);
    setNextButtonReady(false);

    const nextIdx = resolveNextActiveIndex(currentItemIndex);
    if (checkDropCondition(itemResults) || nextIdx === null) {
      setScreen('results');
    } else if (currentItemIndex === 0 && currentTrial === 1) {
      startTrial2(); // unchanged — only reachable when item 1 is active
    } else {
      startItem(nextIdx);
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
    
    showFeedbackMsg(t('game.trial2Label'), 'correct');
    await new Promise(r => setTimeout(r, 2000));
    startTimer();
    await shuffleHouses(0, 1, null, false, null);
    setInteractionLocked(false);
  };

  const handleRetake = async () => {
    if (interactionLocked || isPaused) return;
    if (!window.confirm(t('game.restartTrial').replace('{n}', currentTrial))) return;
    itemRetakesRef.current[currentItemIndex] = (itemRetakesRef.current[currentItemIndex] || 0) + 1;
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
    setQuitReason('');
    setShowPauseModal(true);
    stopTimer();
  };

  const handlePauseAction = async (actionStatus) => {
    if (!quitReason.trim()) { alert(t('common.enterReason')); return; }
    if (actionStatus === 'quit') {
      await saveToServer('quit', null, quitReason);
      setShowPauseModal(false);
      setIsPaused(false);
      setScreen('results');
    } else {
      await saveToServer(actionStatus);
      setIsPaused(false);
      navigate('/');
    }
  };

  const submitAssessment = async () => {
    clearInterval(sessionTimerRef.current);
    if (!gameSessionId) {
      alert(t('common.sessionNotFound'));
      return;
    }
    setIsAssessmentSubmitting(true);
    try {
      if (quitReason) {
        await saveToServer('quit', null, quitReason);
      } else {
        await saveToServer('completed');
      }
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      await axios.post(`${API_URL}/games/assessments`, {
        session_id: gameSessionId,
        child_id: childData?.child_id,
        q1_enjoyment: assessment.q1,
        q2_feeling: assessment.q2,
        q3_tiredness: assessment.q3,
        q4_play_again: assessment.q4,
        q5_behaviors: assessment.behaviors,
        additional_notes: (assessment.notes || '') + (quitReason ? `\n[Quit Reason: ${quitReason}]` : ''),
      }, config);

      // Generate PDF Dashboard
      setTimeout(async () => {
        let wrapper = null;
        try {
          const element = document.getElementById('dashboard-container');
          if (element) {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            // Clone content into a clean wrapper directly on document.body so it has
            // NO .chor-app / .chor-body-shell ancestors — .chor-app has backdrop-filter
            // plus height:100%+overflow:hidden chained to a 100dvh ancestor, which
            // clips the dashboard content (score circle + breakdown table) out of the
            // capture and leaves only the header and assessment form visible in the PDF.
            const originalNodes = element.querySelectorAll('*');
            const clone = element.cloneNode(true);
            const cloneNodes = clone.querySelectorAll('*');

            // Kill all CSS animations BEFORE appending to DOM, same reason as
            // ChaloMelaChaleGame's PDF capture: mid-animation opacity:0 renders blank.
            // Also neutralize any scrollable inner region (e.g. .chor-table-wrapper's
            // overflow-x:auto) — html2canvas paints scrollable content as currently
            // scrolled, so a wide table stays clipped even once the outer container
            // is unconstrained.
            clone.style.animation = 'none';
            clone.style.opacity = '1';
            cloneNodes.forEach((node, i) => {
              node.style.animation = 'none';
              node.style.transition = 'none';
              node.style.opacity = '';
              const cs = window.getComputedStyle(originalNodes[i]);
              if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') node.style.overflowX = 'visible';
              if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') node.style.overflowY = 'visible';
            });

            wrapper = document.createElement('div');
            wrapper.style.cssText = [
              'position:fixed', 'top:-99999px', 'left:0',
              // Use a generous fixed desktop-class width rather than the live
              // element's scrollWidth: on a narrower assessor device/window,
              // .chor-app's `width:100%` + overflow:hidden would inherit
              // that same narrow width, forcing the CSS-grid stat row and
              // wide table to clip instead of laying out naturally.
              'width:' + Math.max(element.scrollWidth, 1400) + 'px',
              'background:#ffffff', 'padding:20px',
              'z-index:-9999', 'pointer-events:none',
            ].join(';');
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(wrapper, {
              scale: 1.5,
              useCORS: true,
              backgroundColor: '#ffffff',
              windowWidth: wrapper.scrollWidth,
              windowHeight: wrapper.scrollHeight,
              logging: false
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.9);

            const pdfWidth = 210;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

            const pdfBlob = pdf.output('blob');

            const formData = new FormData();
            const childNameSafe = (childData?.name || childData?.child_id || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
            const ts = new Date().toISOString().replace(/[:.T-]/g, '').slice(0, 14);
            formData.append('pdf', pdfBlob, `${childNameSafe}_Chor_Machaye_Shor_SES${gameSessionId}_${ts}.pdf`);
            formData.append('child_id', childData.child_id);
            formData.append('session_id', gameSessionId);
            formData.append('game_name', 'chor_machaye_shor');

            await axios.post(`${API_URL}/games/pdfs/upload`, formData, config);
            console.log("Dashboard PDF successfully uploaded for session:", gameSessionId);
          }
        } catch (err) {
          console.error("PDF generation failed:", err);
        } finally {
          if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
        }
      }, 1000);

      setAssessmentSubmitted(true);
      alert(t('game.assessmentSubmitted'));
    } catch (e) {
      console.error('Assessment submission error:', e);
      const msg = e?.response?.data?.message || e?.message || 'Unknown error';
      alert(`${t('common.failedToSave')}\n\nDetails: ${msg}`);
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

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
    recognition.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      }
      if (final) {
        if (target === 'notes' || target === 'assessmentNotes') setAssessment(p => ({ ...p, notes: p.notes + final }));
        else setQuitReason(p => p + final);
      }
    };
    recognition.onend = () => { setIsRecording(false); setRecordingTarget(null); };
    window.activeRecognition = recognition;
    recognition.start();
    setIsRecording(true); setRecordingTarget(target);
  };

  // SPLASH SCREEN
  if (screen === 'splash') {
    return (
      <div className="chor-body-shell">
        <div className="chor-app chor-app-splash">
          <header className="chor-topbar">
            <div className="chor-brand">
              {showLogo && <img src="/cel_admin_logo.png" alt="CEL Logo" className="chor-brand-img" />}
              {showLogo && (showGameIcon || showGameName) && <div className="chor-divider"></div>}
              {showGameIcon && <img src="/assets/images/chor_machaye_shor/chor_machaye_shor.jpg" alt="Chor Machaye Shor" className="chor-test-logo" />}
              {showGameName && <span className="chor-test-title">{t('home.games.chor.title')}</span>}
            </div>
            <div className="chor-stats">
              {showChildId && <div className="chor-stat-pill"><span className="chor-stat-icon">👤</span><span className="chor-stat-value">{childData?.child_id || '—'}</span></div>}
              {showScore && <div className="chor-stat-pill"><span className="chor-stat-icon">🏆</span><span className="chor-stat-value">{totalScore}</span></div>}
            </div>
          </header>
          <main className="chor-main chor-main-splash">
            <div className="chor-screen chor-screen-splash">
              <div className="chor-splash-cover">
                <img src={`${IMG_DIR}/chor_machaye_shor.jpg`} alt="Chor Machaye Shor" className="chor-splash-img-full" onError={e => { e.target.style.display = 'none'; }} />
                <div className="chor-splash-btn-overlay">
                  <button
                    className="chor-btn chor-btn-primary chor-btn-highlight"
                    disabled={!audioFinished}
                    style={!audioFinished ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                    onClick={startGame}
                  >
                    {t('game.startNow')}
                  </button>
                  <button
                    className="chor-btn chor-btn-secondary"
                    onClick={() => {
                      setAudioFinished(false);
                      if (splashAudioRef.current) {
                        splashAudioRef.current.currentTime = 0;
                        splashAudioRef.current.play().catch(() => setAudioFinished(true));
                      }
                    }}
                  >
                    {t('game.replayAudio')}
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
        {/* Modals */}
        {showResumeModal && (
          <div className="chor-modal-overlay">
            <div className="chor-modal-content">
              <h2>{t('game.progressFound')}</h2>
              <p>You have a previously paused game session. Would you like to resume?</p>
              <div className="modal-actions-row">
                <button className="modal-btn modal-btn-cancel" onClick={async () => {
                  setShowResumeModal(false);
                  // Mark old session as dropped/abandoned before starting fresh
                  if (gameSessionId) {
                    try {
                      const token = localStorage.getItem('token');
                      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
                      await axios.post(`${API_URL}/games/sessions/${gameSessionId}`, { status: 'dropped' }, config);
                    } catch (err) {
                      console.error("Failed to mark session as dropped:", err);
                    }
                  }
                  resetGameState();
                  setAudioFinished(false);
                  setScreen('splash');
                }}>{t('game.restartFresh')}</button>
                <button className="modal-btn modal-btn-primary" onClick={() => {
                  resumeGame();
                }}>{t('game.resumeGame')}</button>
              </div>
            </div>
          </div>
        )}
        <audio
          ref={splashAudioRef}
          src={screen === 'splash' ? getAudioUrl('splash', `${AUDIO_DIR}/splash.wav`) : undefined}
          preload="auto"
          onEnded={() => setAudioFinished(true)}
        />
      </div>
    );
  }

  if (screen === 'results') {
    const attempted = itemResults.length;
    const correctCount = itemResults.filter(r => r.completed).length;
    const accuracy = Math.round((correctCount / 18) * 100);
    const tTime = itemResults.reduce((acc, r) => acc + r.timeTaken, 0);
    const tMoves = itemResults.reduce((acc, r) => acc + r.moves, 0);
    const avgTime = attempted > 0 ? Math.round(tTime / attempted) : 0;

    return (
      <div className="chor-body-shell">
        <div className="chor-app" id="dashboard-container">
          <header className="chor-topbar">
            <div className="chor-brand">
              {showLogo && <img src="/cel_admin_logo.png" alt="CEL Logo" className="chor-brand-img" />}
              {showLogo && (showGameIcon || showGameName) && <div className="chor-divider"></div>}
              {showGameIcon && <img src="/assets/images/chor_machaye_shor/chor_machaye_shor.jpg" alt="Chor Machaye Shor" className="chor-test-logo" />}
              {showGameName && <span className="chor-test-title">{t('home.games.chor.title')}</span>}
            </div>
            <div className="chor-stats">
              {showChildId && <div className="chor-stat-pill"><span className="chor-stat-icon">👤</span><span className="chor-stat-value">{childData?.child_id || '—'}</span></div>}
              {showTimer && <div className="chor-stat-pill"><span className="chor-stat-icon">⏱</span><span className="chor-stat-value">{String(Math.floor(tTime/60)).padStart(2,'0')}:{String(tTime%60).padStart(2,'0')}</span></div>}
              {showScore && <div className="chor-stat-pill"><span className="chor-stat-icon">🏆</span><span className="chor-stat-value">{totalScore}</span></div>}
            </div>
          </header>

          <main className="chor-main" style={{ padding: '24px' }}>
            <div className="chor-dashboard-container">
              {/* Header Section */}
              <div className="chor-dash-header">
                <div>
                  <div className="chor-dash-title">{t('game.assessmentComplete')}</div>
                  <div className="chor-dash-subtitle">{quitReason ? 'Assessor requested early exit' : 'Test finished successfully'}</div>
                </div>
                <div className="chor-dash-badges">
                  <span className="chor-chip" style={{ background: '#4f46e5', color: '#fff' }}>{t('game.attemptLabel')}{attemptNo}</span>
                  <span className="chor-chip" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>Screentime: {formatTime(sessionTimerSec)}</span>
                </div>
              </div>

              <div className="chor-dash-content">
              {/* Performance Section */}
              <div className="chor-dash-section">
                
                <div className="chor-dash-stat-grid">
                  <div className="chor-big-score-circle">
                    <span className="score-value">{correctCount}</span>
                    <span className="score-max">/ 18</span>
                  </div>
                  <div className="chor-stat-boxes">
                    <div className="chor-stat-box"><div className="chor-stat-box-label">Correct</div><div className="chor-stat-val text-green">{correctCount}</div></div>
                    <div className="chor-stat-box"><div className="chor-stat-box-label">Incorrect</div><div className="chor-stat-val text-red">{attempted - correctCount}</div></div>
                    <div className="chor-stat-box">
                      <div className="chor-stat-box-label">% Accuracy <span className="kpi-formula-icon" data-tooltip="Correct Answers ÷ Total Questions (18) × 100">ⓘ</span></div>
                      <div className="chor-stat-val">{((correctCount / 18) * 100).toFixed(1)}%</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>{correctCount} / 18</div>
                    </div>
                    <div className="chor-stat-box"><div className="chor-stat-box-label">Duration</div><div className="chor-stat-val">{fmtDuration(tTime)}</div></div>
                    <div className="chor-stat-box"><div className="chor-stat-box-label">Avg Time/Q</div><div className="chor-stat-val">{fmtDuration(avgTime)}</div></div>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Table */}
              <div className="chor-dash-section">
                <div className="chor-table-wrapper">
                  <table className="chor-data-table">
                    <thead>
                      <tr>
                        <th>S.No.</th>
                        <th>Item Name</th>
                        <th>Trial</th>
                        <th>Status</th>
                        <th>Moves</th>
                        <th>Score</th>
                        <th>Duration</th>
                        <th>Retakes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemResults.map((r, i) => {
                        let pillBg = '#fee2e2', pillClr = '#dc2626', pillLabel = 'Incorrect';
                        if (r.completed) { pillBg = '#dcfce7'; pillClr = '#15803d'; pillLabel = 'Correct'; }
                        else if (r.score > 0) { pillBg = '#fef3c7'; pillClr = '#d97706'; pillLabel = 'Partial'; }
                        return (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{(r.itemName || '').replace(/^Item \d+:\s*/, '').replace(/\s*\(Trial \d+\)$/, '')}</td>
                          <td>{r.trial || '—'}</td>
                          <td>
                            <span style={{ display: 'inline-block', background: pillBg, color: pillClr, borderRadius: 999, padding: '3px 12px', fontSize: '0.78rem', fontWeight: 600 }}>{pillLabel}</span>
                          </td>
                          <td>{r.moves}</td>
                          <td>{r.score}</td>
                          <td>{fmtDuration(r.timeTaken)}</td>
                          <td>{r.retakes || 0}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assessment Form */}
              <SessionAssessmentForm
                assessment={assessment}
                setAssessment={setAssessment}
                assessmentSubmitted={assessmentSubmitted}
                isAssessmentSubmitting={isAssessmentSubmitting}
                submitAssessmentForm={submitAssessment}
                isRecording={isRecording}
                recordingTarget={recordingTarget}
                toggleRecording={toggleRecording}
                t={t}
              >
                <>
                  <button className="chor-btn chor-btn-primary" style={{ padding: '12px 32px', borderRadius: 999, background: 'linear-gradient(135deg, #4f46e5, #3730a3)', border: 'none', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => {
                    resetGameState();
                    setAudioFinished(false);
                    setScreen('splash');
                    setAssessmentSubmitted(false);
                    setGameSessionId(null);
                  }}>↻ Retest</button>
                  <button className="chor-btn" style={{ padding: '12px 32px', borderRadius: 999, background: '#e0e7ff', border: 'none', color: '#3730a3', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/')}>🏠 Home</button>
                </>
              </SessionAssessmentForm>
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
  const canNext = nextButtonReady;

  return (
    <div className="chor-body-shell">
      <div className="chor-app">
        <header className="chor-topbar">
          <div className="chor-brand">
            {showLogo && <img src="/cel_admin_logo.png" alt="CEL Logo" className="chor-brand-img" />}
            {showLogo && (showGameIcon || showGameName) && <div className="chor-divider"></div>}
            {showGameIcon && <img src="/assets/images/chor_machaye_shor/chor_machaye_shor.jpg" alt="Chor Machaye Shor" className="chor-test-logo" />}
            {showGameName && <span className="chor-test-title">{t('home.games.chor.title')}</span>}
          </div>
          
          <div className="chor-topbar-center">
             <div className="chor-topbar-screen-title">
               Question {currentItemIndex + 1}
               {currentItem.hasTrials && <div className="chor-chip chor-chip-game" style={{ background: '#4f46e5', color: '#fff', borderColor: '#4338ca' }}>Trial {currentTrial}</div>}
               {phaseLabel && <div className="chor-chip chor-chip-splash">{phaseLabel}</div>}
             </div>
             <div className="chor-topbar-screen-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <span>Move: {currentMove} of {maxAtt}</span>
               <div className="chor-progress-dots">
                 {Array(getConsecutiveRequired()).fill(0).map((_, i) => (
                   <span key={i} className={`chor-dot ${i < correctTouchCount ? 'active' : ''}`} style={{ width: '12px', height: '12px', borderWidth: '1.5px' }}></span>
                 ))}
               </div>
             </div>
          </div>

          <div className="chor-stats">
            {showChildId && <div className="chor-stat-pill"><span className="chor-stat-icon">👤</span><span className="chor-stat-value">{childData?.child_id || '—'}</span></div>}
            {showTimer && <div className="chor-stat-pill"><span className="chor-stat-icon">⏱</span><span className="chor-stat-value">{Math.floor(timerSeconds/60).toString().padStart(2,'0')}:{(timerSeconds%60).toString().padStart(2,'0')}</span></div>}
            {showScore && <div className="chor-stat-pill"><span className="chor-stat-icon">🏆</span><span className="chor-stat-value">{totalScore}</span></div>}
            <button className="btn-pause-quit" onClick={handlePauseClick}><span>⏸</span> Pause/Quit</button>
          </div>
        </header>

        <main className="chor-main">
          <div className="chor-screen">

            {phase1CompletedPending && (
              <div className="phase1-complete-banner">
                🎉 Phase 1 Completed! Click Phase 2 to continue.
              </div>
            )}

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
              {feedback && (
                <div className={`chor-feedback-overlay ${feedback.type} show`}>
                  {feedback.message}
                </div>
              )}
            </div>

            <div className="chor-btn-row" style={{ justifyContent: 'space-between' }}>
              <div>
                {currentItemIndex === 0 && <button className="chor-btn chor-btn-warning" onClick={handleRetake} disabled={interactionLocked}>Retake</button>}
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                {(currentItem.id === 6 || currentItem.id === 7 || currentItem.id === 8 || currentItem.id === 9 || currentItem.id === 10 || currentItem.id === 11) && currentPhase === 1 && (
                  <button 
                    className={`chor-btn ${phase1CompletedPending ? 'chor-btn-highlight' : 'chor-btn-secondary'}`}
                    disabled={!phase1CompletedPending}
                    onClick={handlePhase2Transition}
                  >
                    Phase 2
                  </button>
                )}
                <button 
                  className={`chor-btn ${canNext ? 'chor-btn-highlight' : 'chor-btn-success'}`} 
                  onClick={handleNextClick} 
                  disabled={!canNext}
                >
                  {resolveNextActiveIndex(currentItemIndex) === null || checkDropCondition(itemResults) ? `🏁 ${t('game.finishGame')}` : t('game.nextQuestion')}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showPauseModal && (
        <div className="chor-modal-overlay">
          <div className="chor-modal-content">
            <h2>{t('game.pauseQuitTitle')}</h2>
            <p>{t('game.pauseDesc')}</p>
            <div className="modal-textarea-wrapper">
              <textarea className="modal-textarea" placeholder={t('game.pausePlaceholder')} value={quitReason} onChange={(e) => setQuitReason(e.target.value)}></textarea>
              <button className={`modal-mic-btn ${isRecording ? 'recording' : ''}`} onClick={() => toggleRecording('quit')} title={t('game.dictateReason')}>🎤</button>
            </div>
            <div className="modal-actions-row">
              <button className="modal-btn modal-btn-cancel" onClick={() => { setShowPauseModal(false); setIsPaused(false); startTimer(); }}>{t('common.cancel')}</button>
              <button className="modal-btn modal-btn-pause" onClick={() => handlePauseAction('paused')}>{t('game.pauseSave')}</button>
              <button className="modal-btn modal-btn-quit" onClick={() => handlePauseAction('quit')}>{t('game.quitEnd')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChorMachayeShorGame;
