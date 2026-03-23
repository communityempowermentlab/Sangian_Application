import React, { useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const TestModal = ({ isOpen, onClose, title, subtitle, description, startUrl }) => {
    const { t } = useLanguage();
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
                        {t('modal.disclaimer')}
                    </p>
                    <br />
                    <div className="modal-actions">
                        <button type="button" className="btn modal-btn-secondary" onClick={onClose}>
                            {t('modal.close')}
                        </button>
                        <button
                            type="button"
                            className="btn modal-btn-primary"
                            onClick={() => {
                                if (startUrl) {
                                    window.location.href = startUrl;
                                } else {
                                    alert(t('modal.noUrl'));
                                }
                            }}
                        >
                            {t('modal.startGame')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestModal;
