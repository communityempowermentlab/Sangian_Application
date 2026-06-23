import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';

// Defaults shown until the fetch resolves — games should never silently switch
// modes just because the config request is still in flight.
const DEFAULTS = { responseMatchingMode: 'exact' };

const ResponseMatchingContext = createContext(DEFAULTS);

export const ResponseMatchingProvider = ({ children }) => {
    const [config, setConfig] = useState(DEFAULTS);

    useEffect(() => {
        axios.get(`${API_URL}/public/response-matching-config`)
            .then(({ data }) => setConfig({ ...DEFAULTS, ...data }))
            .catch(() => {}); // keep defaults on error
    }, []);

    return (
        <ResponseMatchingContext.Provider value={config}>
            {children}
        </ResponseMatchingContext.Provider>
    );
};

// Returns { responseMatchingMode: 'exact' | 'partial' } — read by any memory-based
// game whose response validation should follow the global admin setting.
export const useResponseMatching = () => useContext(ResponseMatchingContext);
