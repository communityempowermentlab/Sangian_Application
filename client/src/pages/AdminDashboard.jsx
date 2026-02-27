import React from 'react';

const AdminDashboard = () => {
    return (
        <main className="admin-content" aria-label="Dashboard Content">

            {/* KPI Row */}
            <section className="admin-grid" aria-label="KPIs">
                <div className="admin-card w3">
                    <h3>Total Sangian Texts</h3>
                    <p>All content entries available.</p>
                    <div className="admin-metric">
                        <div className="admin-val">128</div>
                        <div className="admin-tag good">+12 this month</div>
                    </div>
                </div>

                <div className="admin-card w3">
                    <h3>Total Participants</h3>
                    <p>Registered participants (placeholder).</p>
                    <div className="admin-metric">
                        <div className="admin-val">1,024</div>
                        <div className="admin-tag">Live</div>
                    </div>
                </div>

                <div className="admin-card w3">
                    <h3>Last Update</h3>
                    <p>Most recent content change.</p>
                    <div className="admin-metric">
                        <div>
                            <div className="admin-mini-title">Welcome Message</div>
                            <div className="admin-mini-sub">Today • 10:10 AM</div>
                        </div>
                        <div className="admin-tag">Updated</div>
                    </div>
                </div>

                <div className="admin-card w3">
                    <h3>Pending Reviews</h3>
                    <p>Items awaiting approval (placeholder).</p>
                    <div className="admin-metric">
                        <div className="admin-val">7</div>
                        <div className="admin-tag warn">Needs attention</div>
                    </div>
                </div>
            </section>

            {/* Activity + Quick Actions */}
            <section className="admin-grid" aria-label="Insights">
                <div className="admin-card w8">
                    <h3>Recent Activity</h3>
                    <p>Latest actions performed by admins.</p>

                    <table className="admin-table" aria-label="Recent Activity Table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Action</th>
                                <th>Module</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>10:10 AM</td>
                                <td><b>Updated</b></td>
                                <td>Sangian Text</td>
                                <td><span className="admin-status"><span className="admin-s-dot ok"></span>OK</span></td>
                            </tr>
                            <tr>
                                <td>09:52 AM</td>
                                <td><b>Added</b></td>
                                <td>Sangian Text</td>
                                <td><span className="admin-status"><span className="admin-s-dot ok"></span>OK</span></td>
                            </tr>
                            <tr>
                                <td>Yesterday</td>
                                <td><b>Reviewed</b></td>
                                <td>Content</td>
                                <td><span className="admin-status"><span className="admin-s-dot ok"></span>OK</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="admin-card w4">
                    <h3>Quick Actions</h3>
                    <p>Fast shortcuts for common tasks.</p>

                    <div className="admin-quick-actions">
                        <button className="admin-btn admin-btn-primary" type="button">➕ Add New Sangian Text</button>
                        <button className="admin-btn admin-btn-ghost" type="button">🗂️ Manage Texts</button>
                        <button className="admin-btn admin-btn-ghost" type="button">⬇️ Export Report</button>
                    </div>

                    <div className="admin-tip">
                        Tip: This is UI-only. Next step will connect APIs and real data.
                    </div>
                </div>
            </section>

            {/* System health + Notes */}
            <section className="admin-grid" aria-label="KPI Details">
                <div className="admin-card w6">
                    <h3>System Health</h3>
                    <p>Quick overview of services (placeholder).</p>

                    <div className="admin-health">
                        <div className="admin-status"><span className="admin-s-dot ok"></span>API: Online</div>
                        <div className="admin-status"><span className="admin-s-dot ok"></span>Database: Online</div>
                        <div className="admin-status"><span className="admin-s-dot warn"></span>Mail: Degraded</div>
                    </div>
                </div>

                <div className="admin-card w6">
                    <h3>Notes / Announcements</h3>
                    <p>Show internal updates for admins.</p>

                    <ul className="admin-notes">
                        <li>Finalize UI screens (Login → Dashboard → Manage Text).</li>
                        <li>Add roles: Admin / Editor / Reviewer.</li>
                        <li>Integrate backend auth + reCAPTCHA verification.</li>
                    </ul>
                </div>
            </section>

        </main>
    );
};

export default AdminDashboard;
