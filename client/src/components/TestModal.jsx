import React, { useEffect } from 'react';

const TestModal = ({ isOpen, onClose, title, subtitle, description, startUrl }) => {
    // Handle escape key to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" style={{ display: 'flex' }} onClick={onClose}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="modal-close" onClick={onClose}>
                    &times;
                </button>
                <div className="modal-header">
                    <div className="modal-icon">🧠</div>
                    <div>
                        <h3 id="modalTitle">{title || 'Test module'}</h3>
                        <p id="modalSubtitle" className="modal-subtitle">{subtitle}</p>
                    </div>
                </div>
                <div className="modal-body" id="modalBody">
                    {description}
                </div>
                <div className="modal-footer">
                    <p>
                        This description is informational only. Always follow your official KABC manual and institutional protocols when administering tests.
                    </p>
                    <br />
                    <div className="modal-actions">
                        <button type="button" className="btn modal-btn-secondary" onClick={onClose}>
                            Close
                        </button>
                        <button
                            type="button"
                            className="btn modal-btn-primary"
                            onClick={() => {
                                if (startUrl) {
                                    window.location.href = startUrl;
                                } else {
                                    alert("Start URL is not configured for this test yet.");
                                }
                            }}
                        >
                            Start Game
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestModal;
