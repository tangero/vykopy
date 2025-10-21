import React from 'react';
import { GovButton } from '@gov-design-system-ce/react';
import { combineClasses } from '../../config/govDesignSystem';

export interface GovButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  'data-testid'?: string;
}

const Button: React.FC<GovButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  onClick,
  type = 'button',
  className,
  'data-testid': dataTestId,
  ...props
}) => {
  const buttonClasses = combineClasses(
    'gov-button',
    variant && `gov-button--${variant}`,
    size && `gov-button--${size}`,
    fullWidth && 'gov-button--block',
    loading && 'gov-button--loading',
    className
  );

  return (
    <GovButton
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      nativeType={type}
      data-testid={dataTestId}
      {...props}
    >
      {loading && (
        <span className="gov-button__spinner" aria-hidden="true">
          <svg className="gov-spinner" viewBox="0 0 24 24">
            <circle
              className="gov-spinner__circle"
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </span>
      )}
      
      {!loading && icon && iconPosition === 'left' && (
        <span className="gov-button__icon gov-button__icon--left">
          {icon}
        </span>
      )}
      
      <span className="gov-button__text">
        {children}
      </span>
      
      {!loading && icon && iconPosition === 'right' && (
        <span className="gov-button__icon gov-button__icon--right">
          {icon}
        </span>
      )}
    </GovButton>
  );
};

export default Button;