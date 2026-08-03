import React from 'react';
import './KpiInfoIcon.css';

const KpiInfoIcon = ({ 
    name, 
    definition, 
    formula, 
    eligibility, 
    example, 
    notes 
}) => {
    return (
        <div className="kpi-info-icon-wrapper">
            <span className="kpi-info-icon" title="View calculation details">⚙️</span>
            <div className="kpi-info-popover">
                {name && (
                    <div className="kpi-info-section" style={{ fontSize: '0.85rem', color: '#111827', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px' }}>
                        {name}
                    </div>
                )}
                
                {definition && (
                    <div className="kpi-info-section">
                        <div className="kpi-info-label">Definition</div>
                        <div className="kpi-info-text">{definition}</div>
                    </div>
                )}

                {formula && (
                    <div className="kpi-info-section">
                        <div className="kpi-info-label">Formula</div>
                        <div className="kpi-info-text" style={{ fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '4px 6px', borderRadius: '4px', marginTop: '4px' }}>
                            {formula}
                        </div>
                    </div>
                )}

                {eligibility && (
                    <div className="kpi-info-section">
                        <div className="kpi-info-label">Eligibility / Filters</div>
                        <ul className="kpi-info-list kpi-info-text">
                            {Array.isArray(eligibility) 
                                ? eligibility.map((item, idx) => <li key={idx}>{item}</li>)
                                : <li>{eligibility}</li>
                            }
                        </ul>
                    </div>
                )}

                {example && (
                    <div className="kpi-info-section">
                        <div className="kpi-info-label">Example</div>
                        <div className="kpi-info-text" style={{ fontStyle: 'italic', color: '#6b7280' }}>
                            {Array.isArray(example)
                                ? example.map((line, idx) => <div key={idx}>{line}</div>)
                                : example
                            }
                        </div>
                    </div>
                )}

                {notes && (
                    <div className="kpi-info-section">
                        <div className="kpi-info-label">Notes</div>
                        <div className="kpi-info-text">{notes}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KpiInfoIcon;
