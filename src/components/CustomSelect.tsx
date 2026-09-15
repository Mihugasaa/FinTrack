'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  color?: string;
  colorDot?: string;
  icon?: React.ReactNode;
  subtitle?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  id,
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const DROPDOWN_HEIGHT = 230;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUp(spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow);
      }
    }
    setIsOpen(prev => !prev);
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      id={id}
      className={`custom-select-container ${className} ${isOpen ? 'is-open' : ''} ${disabled ? 'disabled' : ''}`}
    >

      <button
        type="button"
        id={id ? `${id}-btn` : undefined}
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={handleToggleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={selectedOption ? `${selectedOption.label}${selectedOption.subtitle ? ` (${selectedOption.subtitle})` : ''}` : placeholder}
      >
        <div className="custom-select-selected-content">
          {selectedOption ? (
            <>
              {(selectedOption.color || selectedOption.colorDot) && (
                <span
                  className="custom-select-color-indicator"
                  style={{ backgroundColor: selectedOption.color || selectedOption.colorDot }}
                />
              )}
              {selectedOption.icon && (
                <span className="custom-select-icon-indicator">
                  {selectedOption.icon}
                </span>
              )}
              <span className="custom-select-label-text" title={selectedOption.label}>
                {selectedOption.label}
              </span>
            </>
          ) : (
            <span className="custom-select-placeholder">
              {placeholder}
            </span>
          )}
        </div>

        <ChevronDown
          size={16}
          className={`custom-select-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </button>

      {isOpen && (
        <div className={`custom-select-dropdown ${openUp ? 'open-up' : ''}`} role="listbox">
          <div className="custom-select-dropdown-list">
            {options.map(option => {
              const isSelected = option.value === value;
              const dotColor = option.color || option.colorDot;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                  title={`${option.label}${option.subtitle ? ` • ${option.subtitle}` : ''}`}
                >
                  <div className="custom-select-option-left">
                    {dotColor && (
                      <span
                        className="custom-select-color-indicator"
                        style={{ backgroundColor: dotColor }}
                      />
                    )}
                    {option.icon && (
                      <span className="custom-select-icon-indicator">
                        {option.icon}
                      </span>
                    )}
                    <div className="custom-select-option-labels">
                      <span className="custom-select-option-title" title={option.label}>
                        {option.label}
                      </span>
                      {option.subtitle && (
                        <span className="custom-select-option-subtitle" title={option.subtitle}>
                          {option.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={15} className="custom-select-check-icon" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
