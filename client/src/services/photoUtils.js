import { API_URL } from './api';

// Strip "/api" suffix to get the server base (e.g. http://localhost:5000)
const SERVER_BASE = API_URL.replace(/\/api$/, '');

/**
 * Returns the full URL for a child photo, or null if no photo is stored.
 * Always use this instead of constructing the URL manually.
 */
export const getChildPhotoUrl = (photo) => {
    if (!photo) return null;
    return `${SERVER_BASE}/uploads/children/${photo}`;
};

/**
 * Inline SVG used as the default avatar when a child has no photo.
 * This avoids any extra network request.
 */
export const DEFAULT_AVATAR_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' rx='40' fill='%23e0e7ff'/><circle cx='40' cy='30' r='14' fill='%236366f1'/><ellipse cx='40' cy='62' rx='22' ry='14' fill='%236366f1'/></svg>`;

/**
 * Returns the photo URL or the default avatar SVG.
 */
export const getChildPhotoOrDefault = (photo) => getChildPhotoUrl(photo) ?? DEFAULT_AVATAR_SVG;
