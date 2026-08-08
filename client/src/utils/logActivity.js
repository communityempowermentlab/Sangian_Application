import axiosAdmin from '../services/axiosAdmin';
import { isStaffSession } from './staffPermissions';

// Fire-and-forget report/export download tracker — call right after an
// export button generates its file. Staff-only (mirrors the page-view
// tracker in AdminLayout.jsx): an admin's own downloads aren't what this
// audit trail is for, and the backend no-ops for admin anyway, so skipping
// the call entirely for admin avoids a pointless request.
export const logReportDownload = ({ module, menuName, pageName, reportName, reportType, format, filters, dateRangeStart, dateRangeEnd, status = 'success' }) => {
    if (!isStaffSession()) return;
    axiosAdmin.post('/admin/staff/log-report-download', {
        module, menuName, pageName, reportName, reportType, format, filters, dateRangeStart, dateRangeEnd, status,
    }).catch(() => {});
};
