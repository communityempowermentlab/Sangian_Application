// ─── useSEO — Lightweight SEO head manager ────────────────────────────────────
// Writes/updates <head> meta, link, and JSON-LD tags on every call.
// No third-party dependencies — pure DOM manipulation.
// Safe to call from multiple components; last caller wins for each tag.

import { useEffect } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function setMeta(attrKey, attrValue, content) {
    const selector = `meta[${attrKey}="${CSS.escape(attrValue)}"]`;
    let el = document.querySelector(selector);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrKey, attrValue);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content ?? '');
}

function setCanonical(href) {
    let el = document.querySelector('link[rel="canonical"]');
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
    }
    el.setAttribute('href', href ?? '');
}

function setJsonLd(data) {
    let el = document.getElementById('seo-jsonld');
    if (!data) {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = document.createElement('script');
        el.id = 'seo-jsonld';
        el.type = 'application/ld+json';
        document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useSEO — apply SEO metadata to <head>.
 *
 * @param {object} seo
 * @param {string}  seo.title
 * @param {string}  seo.description
 * @param {string}  seo.keywords
 * @param {string}  seo.robots          e.g. "index,follow" | "noindex,nofollow"
 * @param {string}  seo.canonical       full URL for this page
 * @param {object}  seo.og              Open Graph fields
 * @param {object}  seo.twitter         Twitter Card fields
 * @param {object|Array|null} seo.jsonLd  JSON-LD structured data (object or array)
 */
export function useSEO(seo) {
    // Serialise to a string so the effect only re-runs when the data actually changes,
    // not on every render (objects are compared by reference otherwise).
    const key = JSON.stringify(seo);

    useEffect(() => {
        const config = JSON.parse(key);
        if (!config) return;

        // ── Title ──────────────────────────────────────────────────────────────
        if (config.title) document.title = config.title;

        // ── Standard meta ──────────────────────────────────────────────────────
        setMeta('name', 'description',  config.description ?? '');
        setMeta('name', 'keywords',     config.keywords    ?? '');
        setMeta('name', 'robots',       config.robots      ?? 'index,follow');

        // ── Canonical ──────────────────────────────────────────────────────────
        if (config.canonical) setCanonical(config.canonical);

        // ── Open Graph ─────────────────────────────────────────────────────────
        const og = config.og ?? {};
        setMeta('property', 'og:type',        og.type        ?? 'website');
        setMeta('property', 'og:title',       og.title       ?? config.title ?? '');
        setMeta('property', 'og:description', og.description ?? config.description ?? '');
        setMeta('property', 'og:image',       og.image       ?? '');
        setMeta('property', 'og:url',         og.url         ?? config.canonical ?? '');
        setMeta('property', 'og:site_name',   og.siteName    ?? '');

        // ── Twitter Card ───────────────────────────────────────────────────────
        const tw = config.twitter ?? {};
        setMeta('name', 'twitter:card',        tw.card        ?? 'summary_large_image');
        setMeta('name', 'twitter:title',       tw.title       ?? config.title ?? '');
        setMeta('name', 'twitter:description', tw.description ?? config.description ?? '');
        setMeta('name', 'twitter:image',       tw.image       ?? '');

        // ── JSON-LD structured data ────────────────────────────────────────────
        setJsonLd(config.jsonLd ?? null);

    }, [key]);
}
