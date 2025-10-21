import React, { forwardRef } from 'react';
import { GovFormInput } from '@gov-design-system-ce/react';
import { combineClasses } from '../../config/govDesignSystem';

export interface GovInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'datetime-local' | 'time';
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: string | boolean;
  success?: boolean;
  helperText?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  'data-testid'?: string;
}

const Input = forwardRef<HTMLInputElement, GovInputProps>(({
  label,
  placeholder,
  value,
  defaultValue,
  type = 'text',
  disabled = false,
  readOnly = false,
  required = false,
  error,
  success = false,
  helperText,
  prefix,
  suffix,
  size = 'medium',
  fullWidth = false,
  autoComplete,
  autoFocus = false,
  maxLength,
  minLength,
  pattern,
  onChange,
  onBlur,
  onFocus,
  className,
  'data-testid': dataTestId,
  ...props
}, ref) => {
  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : undefined;

  const inputClasses = combineClasses(
    'gov-form-control',
    size && `gov-form-control--${size}`,
    hasError && 'gov-form-control--error',
    success && 'gov-form-control--success',
    disabled && 'gov-form-control--disabled',
    fullWidth && 'gov-form-control--block',
    className
  );

  const wrapperClasses = combineClasses(
    'gov-form-group',
    fullWidth && 'gov-form-group--block'
  );

  return (
    <div className={wrapperClasses}>
      {label && (
        <label className="gov-form-label">
          {label}
          {required && <span className="gov-form-label__required" aria-label="povinné">*</span>}
        </label>
      )}
      
      <div className="gov-form-control-wrapper">
        {prefix && (
          <span className="gov-form-control__prefix">
            {prefix}
          </span>
        )}
        
        <GovFormInput
          ref={ref}
          className={inputClasses}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          type={type}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          data-testid={dataTestId}
          aria-invalid={hasError}
          aria-describedby={
            (errorMessage || helperText) ? `${dataTestId || 'input'}-description` : undefined
          }
          {...props}
        />
        
        {suffix && (
          <span className="gov-form-control__suffix">
            {suffix}
          </span>
        )}
      </div>
      
      {(errorMessage || helperText) && (
        <div
          id={`${dataTestId || 'input'}-description`}
          className={combineClasses(
            'gov-form-text',
            hasError && 'gov-form-text--error',
            success && 'gov-form-text--success'
          )}
        >
          {errorMessage || helperText}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'GovInput';

export default Input;