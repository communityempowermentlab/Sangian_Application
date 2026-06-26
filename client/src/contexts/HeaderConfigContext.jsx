import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';

// Defaults shown until the fetch resolves — game headers should never appear empty
// just because the config request is still in flight.
const DEFAULTS = { showLogo: true, showGameIcon: true, showGameName: true, showChildId: true, showTimer: true, showScore: true };

const HeaderConfigContext = createContext(DEFAULTS);

export const HeaderConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(DEFAULTS);

    useEffect(() => {
        axios.get(`${API_URL}/public/header-config`)
            .then(({ data }) => setConfig({ ...DEFAULTS, ...data }))
            .catch(() => {}); // keep defaults on error
    }, []);

    return (
        <HeaderConfigContext.Provider value={config}>
            {children}
        </HeaderConfigContext.Provider>
    );
};

// Returns { showChildId, showTimer, showScore } — read by every game's header.
export const useHeaderConfig = () => useContext(HeaderConfigContext);
