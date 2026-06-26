import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';

// Maps each /games/:slug route to the canonical game_key used by Test Configuration.
const PATH_TO_GAME_KEY = {
    '/games/number_skill':      'numeracy_number_skill',
    '/games/reading_skill':     'literacy_reading_skill',
    '/games/number_recall':     'number_recall_lottery',
    '/games/her_pher':          'working_memory_herpher',
    '/games/dhyan_kahan_hai':   'auditory_dhyan',
    '/games/rachna':            'triangle_rachna',
    '/games/bagiya':            'atlantis_bagiya',
    '/games/chalo_mela_chale':  'rover_mela',
    '/games/chor_machaye_shor': 'cognitive_flex_chor',
};

/**
 * Blocks direct navigation to a game whose test has been disabled in
 * Admin → Settings → Test Configuration, redirecting back to home instead.
 */
const RequireGameEnabled = () => {
    const location = useLocation();
    const [status, setStatus] = useState('loading'); // 'loading' | 'allowed' | 'blocked'

    const gameKey = PATH_TO_GAME_KEY[location.pathname];

    useEffect(() => {
        if (!gameKey) { setStatus('allowed'); return; }
        axios.get(`${API_URL}/public/test-config`)
            .then(({ data }) => setStatus(data[gameKey]?.enabled === false ? 'blocked' : 'allowed'))
            .catch(() => setStatus('allowed')); // fail open rather than locking everyone out on a network blip
    }, [gameKey]);

    if (status === 'loading') return null;
    if (status === 'blocked') return <Navigate to="/" replace />;
    return <Outlet />;
};

export default RequireGameEnabled;
