import React, { useEffect } from 'react';
import { GovButton, Icon } from './gov';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  content: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, content }) => {
  // Close sidebar on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="gov-overlay"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`gov-sidebar ${isOpen ? 'gov-sidebar--open' : ''}`}>
        <div className="gov-sidebar__header">
          <GovButton
            variant="secondary"
            size="small"
            className="gov-sidebar__close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <Icon name="close" />
          </GovButton>
        </div>
        
        <div className="gov-sidebar__content">
          {content}
        </div>
      </div>
    </>
  );
};

export default Sidebar;