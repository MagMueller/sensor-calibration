import { Amplifier, ReferenceSensor, Sensor } from '../types';

// Import JSON data
import brueelData from './devices/brueel.json';
import knickData from './devices/knick.json';
import wikaData from './devices/wika.json';

export type UncertaintyDistribution = 'rectangular' | 'normal';

export class DataLoader {
  private static sensors: Map<string, Sensor> = new Map();
  private static amplifiers: Map<string, Amplifier> = new Map();
  private static referenceSensors: Map<string, ReferenceSensor> = new Map();
  private static initialized = false;

  private static initialize() {
    if (!this.initialized) {
      // Load sensor data
      this.sensors.set('WIKA', wikaData as Sensor);
      
      // Load amplifier data
      this.amplifiers.set('Knick', knickData as Amplifier);
      
      // Load reference sensor data
      this.referenceSensors.set('HBK', brueelData as ReferenceSensor);
      
      this.initialized = true;
    }
  }

  static getSensors(): Sensor[] {
    this.initialize();
    return Array.from(this.sensors.values());
  }

  static getAmplifiers(): Amplifier[] {
    this.initialize();
    return Array.from(this.amplifiers.values());
  }

  static getReferenceSensors(): ReferenceSensor[] {
    this.initialize();
    return Array.from(this.referenceSensors.values());
  }

  static getSensorByManufacturer(manufacturer: string): Sensor | undefined {
    this.initialize();
    return this.sensors.get(manufacturer);
  }

  static getAmplifierByManufacturer(manufacturer: string): Amplifier | undefined {
    this.initialize();
    return this.amplifiers.get(manufacturer);
  }

  static getReferenceSensorByManufacturer(manufacturer: string): ReferenceSensor | undefined {
    this.initialize();
    return this.referenceSensors.get(manufacturer);
  }

  // Utility functions for measurement ranges
  static getPressureRanges(sensor: Sensor): Array<{label: string, value: number | string}> {
    const ranges: Array<{label: string, value: number | string}> = [];
    
    if (sensor.measurement_ranges.relative_pressure_bar) {
      sensor.measurement_ranges.relative_pressure_bar.forEach(range => {
        ranges.push({
          label: `${range} bar (Relativdruck)`,
          value: range
        });
      });
    }
    
    if (sensor.measurement_ranges.absolute_pressure_bar) {
      sensor.measurement_ranges.absolute_pressure_bar.forEach(range => {
        ranges.push({
          label: `${range} bar (Absolutdruck)`,
          value: range
        });
      });
    }
    
    if (sensor.measurement_ranges.vacuum_bar) {
      sensor.measurement_ranges.vacuum_bar.forEach(range => {
        ranges.push({
          label: `${range} bar (Vakuum)`,
          value: range
        });
      });
    }
    
    if (sensor.measurement_ranges["+/-_pressure_bar"]) {
      sensor.measurement_ranges["+/-_pressure_bar"].forEach(range => {
        ranges.push({
          label: `${range} bar (Über-/Unterdruck)`,
          value: range
        });
      });
    }
    
    return ranges;
  }

  // Calculate total measurement uncertainty with distribution consideration
  static calculateTotalUncertainty(
    sensor: Sensor,
    amplifier: Amplifier,
    referenceSensor: ReferenceSensor,
    distribution: UncertaintyDistribution = 'normal'
  ): number {
    // Get base uncertainties
    const sensorAccuracy = sensor.accuracy.standard_span_percent || 0;
    const amplifierAccuracy = amplifier.accuracy.gain_error_percent || 0;
    const referenceAccuracy = referenceSensor.accuracy.accuracy_class || 0;
    
    // Apply distribution factor
    const distributionFactor = this.getDistributionFactor(distribution);
    
    // Convert to standard uncertainties based on distribution
    const sensorStandardUncertainty = sensorAccuracy / distributionFactor;
    const amplifierStandardUncertainty = amplifierAccuracy / distributionFactor;
    const referenceStandardUncertainty = referenceAccuracy / distributionFactor;
    
    // RSS calculation: sqrt(u1² + u2² + u3²)
    const combinedStandardUncertainty = Math.sqrt(
      Math.pow(sensorStandardUncertainty, 2) + 
      Math.pow(amplifierStandardUncertainty, 2) + 
      Math.pow(referenceStandardUncertainty, 2)
    );
    
    // Apply coverage factor for expanded uncertainty (k=2 for 95% confidence)
    const expandedUncertainty = combinedStandardUncertainty * 2;
    
    return Math.round(expandedUncertainty * 10000) / 10000; // Round to 4 decimal places
  }

  // Get distribution factor for converting to standard uncertainty
  private static getDistributionFactor(distribution: UncertaintyDistribution): number {
    switch (distribution) {
      case 'rectangular':
        // For rectangular distribution: k = √3 ≈ 1.732
        return Math.sqrt(3);
      case 'normal':
        // For normal distribution: k = 2 (already assumed as expanded uncertainty)
        return 2;
      default:
        return 2; // Default to normal distribution
    }
  }

  // Calculate detailed uncertainty breakdown
  static calculateDetailedUncertainty(
    sensor: Sensor,
    amplifier: Amplifier,
    referenceSensor: ReferenceSensor,
    distribution: UncertaintyDistribution = 'normal'
  ): {
    sensorUncertainty: number;
    amplifierUncertainty: number;
    referenceUncertainty: number;
    combinedStandardUncertainty: number;
    expandedUncertainty: number;
    coverageFactor: number;
    distribution: UncertaintyDistribution;
    distributionFactor: number;
  } {
    const sensorAccuracy = sensor.accuracy.standard_span_percent || 0;
    const amplifierAccuracy = amplifier.accuracy.gain_error_percent || 0;
    const referenceAccuracy = referenceSensor.accuracy.accuracy_class || 0;
    
    const distributionFactor = this.getDistributionFactor(distribution);
    
    const sensorStandardUncertainty = sensorAccuracy / distributionFactor;
    const amplifierStandardUncertainty = amplifierAccuracy / distributionFactor;
    const referenceStandardUncertainty = referenceAccuracy / distributionFactor;
    
    const combinedStandardUncertainty = Math.sqrt(
      Math.pow(sensorStandardUncertainty, 2) + 
      Math.pow(amplifierStandardUncertainty, 2) + 
      Math.pow(referenceStandardUncertainty, 2)
    );
    
    const coverageFactor = 2; // k=2 for 95% confidence
    const expandedUncertainty = combinedStandardUncertainty * coverageFactor;
    
    return {
      sensorUncertainty: Math.round(sensorStandardUncertainty * 10000) / 10000,
      amplifierUncertainty: Math.round(amplifierStandardUncertainty * 10000) / 10000,
      referenceUncertainty: Math.round(referenceStandardUncertainty * 10000) / 10000,
      combinedStandardUncertainty: Math.round(combinedStandardUncertainty * 10000) / 10000,
      expandedUncertainty: Math.round(expandedUncertainty * 10000) / 10000,
      coverageFactor,
      distribution,
      distributionFactor: Math.round(distributionFactor * 1000) / 1000
    };
  }

  // Get distribution description
  static getDistributionDescription(distribution: UncertaintyDistribution): string {
    switch (distribution) {
      case 'rectangular':
        return 'Rechteckverteilung (k = √3 ≈ 1.732)';
      case 'normal':
        return 'Gauß-Normalverteilung (k = 2)';
      default:
        return 'Unbekannte Verteilung';
    }
  }

  // Calculate optimal gain and offset using linear regression
  static calculateGainAndOffset(measurements: Array<{sollWert: number, istWert: number}>): {
    gain: number;
    offset: number;
    correlation: number;
    rmse: number;
    correctedMeasurements: Array<{
      sollWert: number;
      istWert: number;
      correctedValue: number;
      originalDeviation: number;
      correctedDeviation: number;
      originalDeviationPercent: number;
      correctedDeviationPercent: number;
    }>;
  } {
    const n = measurements.length;
    
    // Calculate sums for linear regression
    const sumX = measurements.reduce((sum, m) => sum + m.sollWert, 0);
    const sumY = measurements.reduce((sum, m) => sum + m.istWert, 0);
    const sumXY = measurements.reduce((sum, m) => sum + m.sollWert * m.istWert, 0);
    const sumXX = measurements.reduce((sum, m) => sum + m.sollWert * m.sollWert, 0);
    const sumYY = measurements.reduce((sum, m) => sum + m.istWert * m.istWert, 0);
    
    // Linear regression formulas
    // Gain (slope) = (n*∑(xy) - ∑x*∑y) / (n*∑(x²) - (∑x)²)
    const gain = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Offset (intercept) = (∑y - slope*∑x) / n
    const offset = (sumY - gain * sumX) / n;
    
    // Calculate correlation coefficient
    const correlation = (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    // Calculate corrected measurements and deviations
    const correctedMeasurements = measurements.map(m => {
      const correctedValue = (m.istWert * gain) + offset;
      const originalDeviation = m.istWert - m.sollWert;
      const correctedDeviation = correctedValue - m.sollWert;
      const originalDeviationPercent = m.sollWert !== 0 ? (originalDeviation / m.sollWert) * 100 : 0;
      const correctedDeviationPercent = m.sollWert !== 0 ? (correctedDeviation / m.sollWert) * 100 : 0;
      
      return {
        sollWert: m.sollWert,
        istWert: m.istWert,
        correctedValue,
        originalDeviation,
        correctedDeviation,
        originalDeviationPercent,
        correctedDeviationPercent
      };
    });
    
    // Calculate RMSE (Root Mean Square Error) for corrected values
    const rmse = Math.sqrt(
      correctedMeasurements.reduce((sum, m) => 
        sum + Math.pow(m.correctedDeviation, 2), 0) / n
    );
    
    return {
      gain: Math.round(gain * 100000) / 100000, // Round to 5 decimal places
      offset: Math.round(offset * 100000) / 100000,
      correlation: Math.round(correlation * 100000) / 100000,
      rmse: Math.round(rmse * 100000) / 100000,
      correctedMeasurements
    };
  }
  
  // Calculate improvement statistics
  static calculateCorrectionStats(correctedData: ReturnType<typeof DataLoader.calculateGainAndOffset>): {
    originalMaxDeviation: number;
    correctedMaxDeviation: number;
    originalAvgDeviation: number;
    correctedAvgDeviation: number;
    originalStdDeviation: number;
    correctedStdDeviation: number;
    improvementPercent: number;
  } {
    const { correctedMeasurements } = correctedData;
    
    const originalDeviations = correctedMeasurements.map(m => Math.abs(m.originalDeviationPercent));
    const correctedDeviations = correctedMeasurements.map(m => Math.abs(m.correctedDeviationPercent));
    
    const originalMaxDeviation = Math.max(...originalDeviations);
    const correctedMaxDeviation = Math.max(...correctedDeviations);
    
    const originalAvgDeviation = originalDeviations.reduce((sum, d) => sum + d, 0) / originalDeviations.length;
    const correctedAvgDeviation = correctedDeviations.reduce((sum, d) => sum + d, 0) / correctedDeviations.length;
    
    const originalStdDeviation = Math.sqrt(
      originalDeviations.reduce((sum, d) => sum + Math.pow(d - originalAvgDeviation, 2), 0) / originalDeviations.length
    );
    const correctedStdDeviation = Math.sqrt(
      correctedDeviations.reduce((sum, d) => sum + Math.pow(d - correctedAvgDeviation, 2), 0) / correctedDeviations.length
    );
    
    const improvementPercent = ((originalAvgDeviation - correctedAvgDeviation) / originalAvgDeviation) * 100;
    
    return {
      originalMaxDeviation: Math.round(originalMaxDeviation * 1000) / 1000,
      correctedMaxDeviation: Math.round(correctedMaxDeviation * 1000) / 1000,
      originalAvgDeviation: Math.round(originalAvgDeviation * 1000) / 1000,
      correctedAvgDeviation: Math.round(correctedAvgDeviation * 1000) / 1000,
      originalStdDeviation: Math.round(originalStdDeviation * 1000) / 1000,
      correctedStdDeviation: Math.round(correctedStdDeviation * 1000) / 1000,
      improvementPercent: Math.round(improvementPercent * 10) / 10
    };
  }

  // Generate measurement points for calibration
  static generateMeasurementPoints(
    range: number | string,
    numPoints: number = 10
  ): number[] {
    const points: number[] = [];
    
    if (typeof range === 'number') {
      // Linear distribution from 0 to full scale
      for (let i = 0; i <= numPoints - 1; i++) {
        const percentage = i / (numPoints - 1);
        points.push(Math.round(range * percentage * 100) / 100);
      }
    } else if (typeof range === 'string' && range.includes('…')) {
      // Handle range strings like "-1…0" or "-1…+1"
      const [minStr, maxStr] = range.split('…');
      const min = parseFloat(minStr);
      const max = parseFloat(maxStr.replace('+', ''));
      
      for (let i = 0; i <= numPoints - 1; i++) {
        const percentage = i / (numPoints - 1);
        const value = min + (max - min) * percentage;
        points.push(Math.round(value * 100) / 100);
      }
    }
    
    return points;
  }
} 