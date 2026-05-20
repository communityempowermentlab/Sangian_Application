import React, { createContext, useContext, useState } from 'react';

const PROJ_KEY = 'ca_firebase_project_id';
const APP_KEY  = 'ca_firebase_app_id';

const CrashAnalyticsContext = createContext(null);

export const CrashAnalyticsProvider = ({ children }) => {
    const [projectId, setProjectIdState] = useState(
        () => localStorage.getItem(PROJ_KEY) || ''
    );
    const [selectedAppId, setSelectedAppIdState] = useState(
        () => localStorage.getItem(APP_KEY) || ''
    );

    const setProjectId = (id) => {
        try { localStorage.setItem(PROJ_KEY, id); } catch { /* ignore */ }
        setProjectIdState(id);
    };

    const setSelectedAppId = (id) => {
        try { localStorage.setItem(APP_KEY, id); } catch { /* ignore */ }
        setSelectedAppIdState(id);
    };

    const disconnect = () => {
        try {
            localStorage.removeItem(PROJ_KEY);
            localStorage.removeItem(APP_KEY);
        } catch { /* ignore */ }
        setProjectIdState('');
        setSelectedAppIdState('');
    };

    return (
        <CrashAnalyticsContext.Provider value={{ projectId, selectedAppId, setProjectId, setSelectedAppId, disconnect }}>
            {children}
        </CrashAnalyticsContext.Provider>
    );
};

export const useCrashAnalytics = () => useContext(CrashAnalyticsContext);
