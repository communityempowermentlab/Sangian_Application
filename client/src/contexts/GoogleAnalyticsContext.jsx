import React, { createContext, useContext, useState } from 'react';

const GA_TOKEN_KEY  = 'ga_access_token';
const GA_EXPIRY_KEY = 'ga_token_expiry';
const GA_PROP_KEY   = 'ga_property_id';

const GoogleAnalyticsContext = createContext(null);

const readToken = () => {
    try {
        const token  = sessionStorage.getItem(GA_TOKEN_KEY);
        const expiry = sessionStorage.getItem(GA_EXPIRY_KEY);
        if (token && expiry && Date.now() < Number(expiry)) return token;
    } catch { /* sessionStorage unavailable (e.g. blocked) */ }
    sessionStorage.removeItem(GA_TOKEN_KEY);
    sessionStorage.removeItem(GA_EXPIRY_KEY);
    return null;
};

export const GoogleAnalyticsProvider = ({ children }) => {
    const [accessToken, setAccessToken] = useState(readToken);
    const [propertyId, setPropertyIdState] = useState(
        () => localStorage.getItem(GA_PROP_KEY) || ''
    );

    // Called after successful Google OAuth — expiresIn is in seconds (default 3600)
    const gaLogin = (token, expiresIn = 3600) => {
        const expiry = Date.now() + expiresIn * 1000;
        try {
            sessionStorage.setItem(GA_TOKEN_KEY,  token);
            sessionStorage.setItem(GA_EXPIRY_KEY, String(expiry));
        } catch { /* ignore storage errors */ }
        setAccessToken(token);
    };

    // Called on manual disconnect or token error
    const gaLogout = () => {
        try {
            sessionStorage.removeItem(GA_TOKEN_KEY);
            sessionStorage.removeItem(GA_EXPIRY_KEY);
        } catch { /* ignore */ }
        setAccessToken(null);
    };

    const setPropertyId = (pid) => {
        try { localStorage.setItem(GA_PROP_KEY, pid); } catch { /* ignore */ }
        setPropertyIdState(pid);
    };

    return (
        <GoogleAnalyticsContext.Provider value={{ accessToken, propertyId, gaLogin, gaLogout, setPropertyId }}>
            {children}
        </GoogleAnalyticsContext.Provider>
    );
};

export const useGoogleAnalytics = () => useContext(GoogleAnalyticsContext);
