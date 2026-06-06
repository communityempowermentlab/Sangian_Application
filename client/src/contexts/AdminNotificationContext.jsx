import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axiosAdmin from '../services/axiosAdmin';

const AdminNotificationContext = createContext({
    newMessageCount:     0,
    activeTicketCount:   0,
    refreshCount:        () => {},
});

export const AdminNotificationProvider = ({ children }) => {
    const [newMessageCount,   setNewMessageCount]   = useState(0);
    const [activeTicketCount, setActiveTicketCount] = useState(0);
    const intervalRef = useRef(null);

    const refreshCount = useCallback(async () => {
        try {
            const [msgRes, ticketRes] = await Promise.allSettled([
                axiosAdmin.get('/admin/contact-messages/new-count'),
                axiosAdmin.get('/admin/tickets/active-count'),
            ]);
            if (msgRes.status === 'fulfilled' && msgRes.value.data.success) {
                setNewMessageCount(msgRes.value.data.count);
            }
            if (ticketRes.status === 'fulfilled' && ticketRes.value.data.success) {
                setActiveTicketCount(ticketRes.value.data.count);
            }
        } catch {}
    }, []);

    useEffect(() => {
        refreshCount();
        intervalRef.current = setInterval(refreshCount, 30000);
        return () => clearInterval(intervalRef.current);
    }, [refreshCount]);

    return (
        <AdminNotificationContext.Provider value={{ newMessageCount, activeTicketCount, refreshCount }}>
            {children}
        </AdminNotificationContext.Provider>
    );
};

export const useAdminNotification = () => useContext(AdminNotificationContext);
