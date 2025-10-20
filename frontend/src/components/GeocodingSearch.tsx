import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
  bbox?: [number, number, number, number];
  place_type: string[];
}

interface GeocodingSearchProps {
  map: MapboxMap | null;
  onResultSelect?: (result: SearchResult) => void;
  className?: string;
}

const GeocodingSearch: React.FC<GeocodingSearchProps> = ({ 
  map, 
  onResultSelect, 
  className = '' 
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Mock geocoding function - in real implementation, this would call a geocoding API
  const mockGeocode = useCallback(async (searchQuery: string): Promise<SearchResult[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Mock results for Czech locations
    const mockResults: SearchResult[] = [
      {
        id: '1',
        place_name: 'Praha, Česká republika',
        center: [14.4378, 50.0755],
        bbox: [14.2244, 49.9419, 14.7067, 50.1774],
        place_type: ['place']
      },
      {
        id: '2',
        place_name: 'Brno, Česká republika',
        center: [16.6068, 49.1951],
        bbox: [16.4816, 49.1378, 16.7320, 49.2524],
        place_type: ['place']
      },
      {
        id: '3',
        place_name: 'Ostrava, Česká republika',
        center: [18.2820, 49.8209],
        bbox: [18.1068, 49.7409, 18.4572, 49.9009],
        place_type: ['place']
      },
      {
        id: '4',
        place_name: 'Plzeň, Česká republika',
        center: [13.3777, 49.7384],
        bbox: [13.2525, 49.6784, 13.5029, 49.7984],
        place_type: ['place']
      },
      {
        id: '5',
        place_name: 'Liberec, Česká republika',
        center: [15.0543, 50.7663],
        bbox: [14.9291, 50.7063, 15.1795, 50.8263],
        place_type: ['place']
      }
    ];

    // Filter results based on query
    return mockResults.filter(result => 
      result.place_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const searchResults = await mockGeocode(searchQuery);
      setResults(searchResults);
      setIsOpen(searchResults.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Geocoding error:', error);
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [mockGeocode]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [performSearch]);

  const handleResultClick = useCallback((result: SearchResult) => {
    setQuery(result.place_name);
    setIsOpen(false);
    setSelectedIndex(-1);

    // Fly to location on map
    if (map) {
      if (result.bbox) {
        map.fitBounds(result.bbox as any, {
          padding: 50,
          duration: 1000
        });
      } else {
        map.flyTo({
          center: result.center,
          zoom: 14,
          duration: 1000
        });
      }
    }

    if (onResultSelect) {
      onResultSelect(result);
    }
  }, [map, onResultSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, results, selectedIndex, handleResultClick]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={searchRef} className={`geocoding-search ${className}`}>
      <div className="search-input-container">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Hledat adresu nebo místo..."
          className="geocoding-input"
        />
        
        {isLoading && (
          <div className="search-loading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="loading-spinner">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
          </div>
        )}
        
        {query && !isLoading && (
          <button 
            className="search-clear"
            onClick={handleClear}
            title="Vymazat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="search-results">
          {results.map((result, index) => (
            <button
              key={result.id}
              className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleResultClick(result)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="location-icon">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span className="result-text">{result.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GeocodingSearch;