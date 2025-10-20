import React, { useState, useCallback } from 'react';

export interface FilterOptions {
  states: string[];
  workTypes: string[];
  applicants: string[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  searchQuery: string;
}

interface MapFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onSearch: (query: string) => void;
  className?: string;
}

const MapFilters: React.FC<MapFiltersProps> = ({ 
  filters, 
  onFiltersChange, 
  onSearch, 
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.searchQuery);

  // Available filter options
  const stateOptions = [
    { value: 'draft', label: 'Koncept' },
    { value: 'forward_planning', label: 'Předběžné plánování' },
    { value: 'pending_approval', label: 'Čeká na schválení' },
    { value: 'approved', label: 'Schváleno' },
    { value: 'in_progress', label: 'Probíhá' },
    { value: 'completed', label: 'Dokončeno' },
    { value: 'rejected', label: 'Zamítnuto' },
    { value: 'cancelled', label: 'Zrušeno' }
  ];

  const workTypeOptions = [
    { value: 'Rekonstrukce vodovodu', label: 'Rekonstrukce vodovodu' },
    { value: 'Oprava plynovodu', label: 'Oprava plynovodu' },
    { value: 'Rekonstrukce komunikace', label: 'Rekonstrukce komunikace' },
    { value: 'Pokládka telekomunikačních kabelů', label: 'Telekomunikační kabely' },
    { value: 'Oprava kanalizace', label: 'Oprava kanalizace' },
    { value: 'Instalace veřejného osvětlení', label: 'Veřejné osvětlení' }
  ];

  const applicantOptions = [
    { value: 'Vodárny Středních Čech', label: 'Vodárny Středních Čech' },
    { value: 'Pražská plynárenská', label: 'Pražská plynárenská' },
    { value: 'Město Praha', label: 'Město Praha' },
    { value: 'O2 Czech Republic', label: 'O2 Czech Republic' },
    { value: 'Pražské vodovody a kanalizace', label: 'Pražské vodovody a kanalizace' },
    { value: 'Městská část Praha 2', label: 'Městská část Praha 2' }
  ];

  const handleStateChange = useCallback((state: string, checked: boolean) => {
    const newStates = checked 
      ? [...filters.states, state]
      : filters.states.filter(s => s !== state);
    
    onFiltersChange({
      ...filters,
      states: newStates
    });
  }, [filters, onFiltersChange]);

  const handleWorkTypeChange = useCallback((workType: string, checked: boolean) => {
    const newWorkTypes = checked 
      ? [...filters.workTypes, workType]
      : filters.workTypes.filter(wt => wt !== workType);
    
    onFiltersChange({
      ...filters,
      workTypes: newWorkTypes
    });
  }, [filters, onFiltersChange]);

  const handleApplicantChange = useCallback((applicant: string, checked: boolean) => {
    const newApplicants = checked 
      ? [...filters.applicants, applicant]
      : filters.applicants.filter(a => a !== applicant);
    
    onFiltersChange({
      ...filters,
      applicants: newApplicants
    });
  }, [filters, onFiltersChange]);

  const handleDateRangeChange = useCallback((field: 'startDate' | 'endDate', value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value
      }
    });
  }, [filters, onFiltersChange]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
    onFiltersChange({
      ...filters,
      searchQuery: searchInput
    });
  }, [searchInput, onSearch, filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    const clearedFilters: FilterOptions = {
      states: [],
      workTypes: [],
      applicants: [],
      dateRange: { startDate: '', endDate: '' },
      searchQuery: ''
    };
    
    setSearchInput('');
    onFiltersChange(clearedFilters);
    onSearch('');
  }, [onFiltersChange, onSearch]);

  const getActiveFilterCount = () => {
    return filters.states.length + 
           filters.workTypes.length + 
           filters.applicants.length + 
           (filters.dateRange.startDate ? 1 : 0) + 
           (filters.dateRange.endDate ? 1 : 0) +
           (filters.searchQuery ? 1 : 0);
  };

  return (
    <div className={`map-filters ${className}`}>
      <div className="filters-header">
        <button 
          className="filters-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
          </svg>
          <span>Filtry</span>
          {getActiveFilterCount() > 0 && (
            <span className="filter-count">{getActiveFilterCount()}</span>
          )}
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="currentColor"
            className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
          >
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="filters-content">
          {/* Search */}
          <div className="filter-section">
            <h4>Vyhledávání</h4>
            <form onSubmit={handleSearchSubmit} className="search-form">
              <div className="search-input-group">
                <input
                  type="text"
                  placeholder="Hledat podle názvu, žadatele, adresy..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="search-input"
                />
                <button type="submit" className="search-button">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                  </svg>
                </button>
              </div>
            </form>
          </div>

          {/* Date Range */}
          <div className="filter-section">
            <h4>Časové období</h4>
            <div className="date-range">
              <div className="date-input">
                <label>Od:</label>
                <input
                  type="date"
                  value={filters.dateRange.startDate}
                  onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                />
              </div>
              <div className="date-input">
                <label>Do:</label>
                <input
                  type="date"
                  value={filters.dateRange.endDate}
                  onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Project States */}
          <div className="filter-section">
            <h4>Stav projektu</h4>
            <div className="checkbox-group">
              {stateOptions.map(option => (
                <label key={option.value} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.states.includes(option.value)}
                    onChange={(e) => handleStateChange(option.value, e.target.checked)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Work Types */}
          <div className="filter-section">
            <h4>Typ práce</h4>
            <div className="checkbox-group">
              {workTypeOptions.map(option => (
                <label key={option.value} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.workTypes.includes(option.value)}
                    onChange={(e) => handleWorkTypeChange(option.value, e.target.checked)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Applicants */}
          <div className="filter-section">
            <h4>Žadatel</h4>
            <div className="checkbox-group">
              {applicantOptions.map(option => (
                <label key={option.value} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.applicants.includes(option.value)}
                    onChange={(e) => handleApplicantChange(option.value, e.target.checked)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          <div className="filter-actions">
            <button 
              className="clear-filters-button"
              onClick={handleClearFilters}
              disabled={getActiveFilterCount() === 0}
            >
              Vymazat všechny filtry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapFilters;