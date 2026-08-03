import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './KpiInfoIcon.css';

const KpiInfoIcon = ({ 
    name, 
    definition, 
    formula, 
    dataSource,
    filtersApplied,
    inclusionCriteria,
    exclusionCriteria,
    dateRange,
    eligibility, 
    example, 
    notes 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const iconRef = useRef(null);

    const updatePosition = () => {
        if (iconRef.current) {
            const rect = iconRef.current.getBoundingClientRect();
            setCoords({
                left: rect.left + rect.width / 2,
                top: rect.top - 8,
            });
        }
    };

    const handleMouseEnter = () => {
        updatePosition();
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        setIsOpen(false);
    };
    
    useEffect(() => {
        if (!isOpen) return;
        const onScroll = () => updatePosition();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [isOpen]);

    const popoverContent = (
        <div 
            className="kpi-info-popover-portal" 
            style={{ 
                top: coords.top, 
                left: coords.left 
            }}
            onMouseEnter={handleMouseEnter} // keep open if hovering over the popover
            onMouseLeave={handleMouseLeave}
        >
            {name && (
                <div className="kpi-info-section kpi-info-title">
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
                    <div className="kpi-info-label">Calculation Formula</div>
                    <div className="kpi-info-formula-text">
                        {formula}
                    </div>
                </div>
            )}
            
            {dataSource && (
                <div className="kpi-info-section">
                    <div className="kpi-info-label">Data Source (Database/Table)</div>
                    <div className="kpi-info-text">{dataSource}</div>
                </div>
            )}

            {filtersApplied && (
                <div className="kpi-info-section">
                    <div className="kpi-info-label">Filters Applied</div>
                    <ul className="kpi-info-list kpi-info-text">
                        {Array.isArray(filtersApplied) 
                            ? filtersApplied.map((item, idx) => <li key={idx}>{item}</li>)
                            : <li>{filtersApplied}</li>
                        }
                    </ul>
                </div>
            )}
            
            {eligibility && !inclusionCriteria && (
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

            {inclusionCriteria && (
                <div className="kpi-info-section">
                    <div className="kpi-info-label">Inclusion Criteria</div>
                    <ul className="kpi-info-list kpi-info-text">
                        {Array.isArray(inclusionCriteria) 
                            ? inclusionCriteria.map((item, idx) => <li key={idx}>{item}</li>)
                            : <li>{inclusionCriteria}</li>
                        }
                    </ul>
                </div>
            )}

            {exclusionCriteria && (
                <div className="kpi-info-section">
                    <div className="kpi-info-label">Exclusion Criteria</div>
                    <ul className="kpi-info-list kpi-info-text">
                        {Array.isArray(exclusionCriteria) 
                            ? exclusionCriteria.map((item, idx) => <li key={idx}>{item}</li>)
                            : <li>{exclusionCriteria}</li>
                        }
                    </ul>
                </div>
            )}

            {dateRange && (
                <div className="kpi-info-section">
                    <div className="kpi-info-label">Date Range Considered</div>
                    <div className="kpi-info-text">{dateRange}</div>
                </div>
            )}

            {example && (
                <div className="kpi-info-section">
                    <div className="kpi-info-label">Sample Calculation</div>
                    <div className="kpi-info-example-text">
                        {Array.isArray(example)
                            ? example.map((line, idx) => <div key={idx}>{line}</div>)
                            : example
                        }
                    </div>
                </div>
            )}

            {notes && (
                <div className="kpi-info-section">
                    <div className="kpi-info-label">Important Notes</div>
                    <div className="kpi-info-text">{notes}</div>
                </div>
            )}
        </div>
    );

    return (
        <div 
            className="kpi-info-icon-wrapper"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => setIsOpen(!isOpen)}
            ref={iconRef}
        >
            <span className="kpi-info-icon" title="View calculation details">⚙️</span>
            {isOpen && createPortal(popoverContent, document.body)}
        </div>
    );
};

export default KpiInfoIcon;
