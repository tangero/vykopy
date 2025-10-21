import React from 'react';
import { GovCard } from '@gov-design-system-ce/react';
import { combineClasses } from '../../config/govDesignSystem';

export interface GovCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'bordered' | 'elevated' | 'outline';
  size?: 'small' | 'medium' | 'large';
  padding?: 'none' | 'small' | 'medium' | 'large';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  'data-testid'?: string;
}

const Card: React.FC<GovCardProps> = ({
  children,
  title,
  subtitle,
  variant = 'default',
  size = 'medium',
  padding = 'medium',
  header,
  footer,
  actions,
  className,
  onClick,
  'data-testid': dataTestId,
  ...props
}) => {
  const cardClasses = combineClasses(
    'gov-card',
    variant && variant !== 'default' && `gov-card--${variant}`,
    size && size !== 'medium' && `gov-card--${size}`,
    padding && padding !== 'medium' && `gov-card--padding-${padding}`,
    onClick && 'gov-card--clickable',
    className
  );

  return (
    <GovCard
      className={cardClasses}
      onClick={onClick}
      data-testid={dataTestId}
      {...props}
    >
      {(header || title || subtitle) && (
        <div className="gov-card__header">
          {header}
          {(title || subtitle) && (
            <div className="gov-card__title-section">
              {title && (
                <h3 className="gov-card__title">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="gov-card__subtitle">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="gov-card__body">
        {children}
      </div>
      
      {(footer || actions) && (
        <div className="gov-card__footer">
          {footer}
          {actions && (
            <div className="gov-card__actions">
              {actions}
            </div>
          )}
        </div>
      )}
    </GovCard>
  );
};

export default Card;