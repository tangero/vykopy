// Utility functions for geometry validation and simplification

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  simplifiedGeometry?: GeoJSON.Geometry;
}

// Validate a geometry object
export const validateGeometry = (geometry: GeoJSON.Geometry): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!geometry || !geometry.type) {
    result.isValid = false;
    result.errors.push('Geometrie není definována');
    return result;
  }

  switch (geometry.type) {
    case 'Point':
      return validatePoint(geometry as GeoJSON.Point);
    case 'LineString':
      return validateLineString(geometry as GeoJSON.LineString);
    case 'Polygon':
      return validatePolygon(geometry as GeoJSON.Polygon);
    default:
      result.isValid = false;
      result.errors.push(`Nepodporovaný typ geometrie: ${geometry.type}`);
      return result;
  }
};

// Validate Point geometry
const validatePoint = (point: GeoJSON.Point): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!point.coordinates || point.coordinates.length !== 2) {
    result.isValid = false;
    result.errors.push('Bod musí mít přesně 2 souřadnice');
    return result;
  }

  const [lng, lat] = point.coordinates;

  // Check if coordinates are valid numbers
  if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
    result.isValid = false;
    result.errors.push('Souřadnice musí být platná čísla');
    return result;
  }

  // Check if coordinates are within Czech Republic bounds (approximately)
  if (lng < 12.0 || lng > 18.9 || lat < 48.5 || lat > 51.1) {
    result.warnings.push('Bod se nachází mimo území České republiky');
  }

  result.simplifiedGeometry = point;
  return result;
};

// Validate LineString geometry
const validateLineString = (line: GeoJSON.LineString): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!line.coordinates || line.coordinates.length < 2) {
    result.isValid = false;
    result.errors.push('Linie musí mít alespoň 2 body');
    return result;
  }

  // Validate each coordinate
  for (let i = 0; i < line.coordinates.length; i++) {
    const coord = line.coordinates[i];
    if (!coord || coord.length !== 2) {
      result.isValid = false;
      result.errors.push(`Neplatná souřadnice na pozici ${i + 1}`);
      return result;
    }

    const [lng, lat] = coord;
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      result.isValid = false;
      result.errors.push(`Neplatné souřadnice na pozici ${i + 1}`);
      return result;
    }
  }

  // Check for duplicate consecutive points
  const simplified = simplifyLineString(line);
  if (simplified.coordinates.length < line.coordinates.length) {
    result.warnings.push(`Odstraněno ${line.coordinates.length - simplified.coordinates.length} duplicitních bodů`);
  }

  // Check minimum length (10 meters approximately)
  const length = calculateLineLength(simplified);
  if (length < 10) {
    result.warnings.push('Linie je velmi krátká (méně než 10 metrů)');
  }

  result.simplifiedGeometry = simplified;
  return result;
};

// Validate Polygon geometry
const validatePolygon = (polygon: GeoJSON.Polygon): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!polygon.coordinates || polygon.coordinates.length === 0) {
    result.isValid = false;
    result.errors.push('Polygon musí mít alespoň jeden ring');
    return result;
  }

  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) {
    result.isValid = false;
    result.errors.push('Polygon musí mít alespoň 4 body (včetně uzavíracího bodu)');
    return result;
  }

  // Check if polygon is closed
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    result.isValid = false;
    result.errors.push('Polygon musí být uzavřený (první a poslední bod musí být stejný)');
    return result;
  }

  // Validate each coordinate
  for (let i = 0; i < ring.length; i++) {
    const coord = ring[i];
    if (!coord || coord.length !== 2) {
      result.isValid = false;
      result.errors.push(`Neplatná souřadnice na pozici ${i + 1}`);
      return result;
    }

    const [lng, lat] = coord;
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      result.isValid = false;
      result.errors.push(`Neplatné souřadnice na pozici ${i + 1}`);
      return result;
    }
  }

  // Simplify polygon
  const simplified = simplifyPolygon(polygon);
  if (simplified.coordinates[0].length < ring.length) {
    result.warnings.push(`Odstraněno ${ring.length - simplified.coordinates[0].length} duplicitních bodů`);
  }

  // Check minimum area (100 square meters approximately)
  const area = calculatePolygonArea(simplified);
  if (area < 100) {
    result.warnings.push('Polygon má velmi malou plochu (méně než 100 m²)');
  }

  // Check for self-intersection (basic check)
  if (hasSelfintersection(simplified)) {
    result.warnings.push('Polygon může obsahovat průsečíky sám se sebou');
  }

  result.simplifiedGeometry = simplified;
  return result;
};

// Simplify LineString by removing duplicate consecutive points
const simplifyLineString = (line: GeoJSON.LineString): GeoJSON.LineString => {
  const simplified: number[][] = [];
  
  for (let i = 0; i < line.coordinates.length; i++) {
    const current = line.coordinates[i];
    const previous = simplified[simplified.length - 1];
    
    // Add point if it's different from the previous one
    if (!previous || current[0] !== previous[0] || current[1] !== previous[1]) {
      simplified.push(current);
    }
  }

  return {
    type: 'LineString',
    coordinates: simplified
  };
};

// Simplify Polygon by removing duplicate consecutive points
const simplifyPolygon = (polygon: GeoJSON.Polygon): GeoJSON.Polygon => {
  const ring = polygon.coordinates[0];
  const simplified: number[][] = [];
  
  for (let i = 0; i < ring.length - 1; i++) { // Exclude last point (closing point)
    const current = ring[i];
    const previous = simplified[simplified.length - 1];
    
    // Add point if it's different from the previous one
    if (!previous || current[0] !== previous[0] || current[1] !== previous[1]) {
      simplified.push(current);
    }
  }

  // Close the polygon
  if (simplified.length > 0) {
    simplified.push(simplified[0]);
  }

  return {
    type: 'Polygon',
    coordinates: [simplified]
  };
};

// Calculate approximate length of a LineString in meters
const calculateLineLength = (line: GeoJSON.LineString): number => {
  let length = 0;
  
  for (let i = 1; i < line.coordinates.length; i++) {
    const prev = line.coordinates[i - 1];
    const curr = line.coordinates[i];
    length += haversineDistance(prev[1], prev[0], curr[1], curr[0]);
  }
  
  return length;
};

// Calculate approximate area of a Polygon in square meters
const calculatePolygonArea = (polygon: GeoJSON.Polygon): number => {
  const ring = polygon.coordinates[0];
  let area = 0;
  
  for (let i = 0; i < ring.length - 1; i++) {
    const curr = ring[i];
    const next = ring[i + 1];
    area += (curr[0] * next[1] - next[0] * curr[1]);
  }
  
  // Convert to square meters (very rough approximation)
  return Math.abs(area) * 12400000000; // Approximate conversion factor
};

// Basic self-intersection check for polygons
const hasSelfintersection = (polygon: GeoJSON.Polygon): boolean => {
  const ring = polygon.coordinates[0];
  
  // Simple check: if any three consecutive points are collinear, it might indicate issues
  for (let i = 0; i < ring.length - 2; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    const p3 = ring[i + 2];
    
    // Check if points are collinear (cross product near zero)
    const cross = (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
    if (Math.abs(cross) < 1e-10) {
      return true;
    }
  }
  
  return false;
};

// Haversine distance calculation
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};