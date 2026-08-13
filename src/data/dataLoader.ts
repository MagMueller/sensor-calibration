import {
  Amplifier,
  CalibrationSetup,
  DataAcquisitionDevice,
  GainOffsetResult,
  MeasurementRange,
  ReferenceConversion,
  ReferenceSensor,
  Sensor,
  TestBench,
  ToleranceStatus,
  TurAssessment,
  UncertaintyBreakdown,
  UncertaintyDistribution
} from '../types';
import { amplifiers, dataAcquisitionDevices, references, sensors } from './deviceCatalog';
import { builtInTestBenches } from './testBenches';

export class DataLoader {
  static getSensors(): Sensor[] { return sensors; }
  static getAmplifiers(): Amplifier[] { return amplifiers; }
  static getReferenceSensors(): ReferenceSensor[] { return references; }
  static getDataAcquisitionDevices(): DataAcquisitionDevice[] { return dataAcquisitionDevices; }
  static getTestBenches(): TestBench[] { return builtInTestBenches; }

  static getCompatibleAmplifiers(sensor: Sensor): Amplifier[] {
    return amplifiers.filter(device =>
      device.supportedMeasurands.includes(sensor.measurand)
      && device.supportedSignals.some(signal => sensor.outputSignals.includes(signal))
    );
  }

  static getCompatibleReferences(sensor: Sensor, range?: MeasurementRange, referenceUnit?: string): ReferenceSensor[] {
    return references.filter(reference => {
      const directReference = reference.measurand === sensor.measurand;
      const convertedReference = reference.supportedTargetMeasurands?.includes(sensor.measurand) ?? false;
      if (!directReference && !convertedReference) return false;
      if (referenceUnit && !reference.ranges.some(referenceRange => referenceRange.unit === referenceUnit)) return false;
      if (!range) return true;
      if (convertedReference) return true;
      return reference.ranges.some(referenceRange =>
        referenceRange.measurand === range.measurand
        && referenceRange.min <= range.min
        && referenceRange.max >= range.max
      );
    });
  }

  static validateReferenceConversion(conversion: ReferenceConversion) {
    if (!conversion.referenceUnit.trim() || !conversion.targetUnit.trim()) return false;
    if (!Number.isFinite(conversion.offset) || !Number.isFinite(conversion.factor) || conversion.factor === 0) return false;
    if (conversion.mode === 'load-cell') return Boolean((conversion.ratedForceN ?? 0) > 0 && (conversion.sensitivityMvV ?? 0) > 0);
    if (conversion.mode === 'pulse-flow') return Boolean((conversion.pulseVolumeCm3 ?? 0) > 0);
    if (conversion.mode === 'torque-lever') {
      const angleFactor = Math.sin((conversion.leverAngleDeg ?? 90) * Math.PI / 180);
      return Boolean(
        (conversion.leverLengthM ?? 0) > 0
        && (conversion.leverInputKind === 'force' || conversion.leverInputKind === 'mass')
        && (conversion.leverInputKind !== 'mass' || (conversion.gravityMs2 ?? 0) > 0)
        && Math.abs(angleFactor) > Number.EPSILON
        && (conversion.direction === 1 || conversion.direction === -1)
        && Number.isFinite(conversion.tareTorqueNm ?? 0)
      );
    }
    if (conversion.mode === 'calibrated-signal') {
      const referenceSpan = (conversion.calibratedReferenceValue ?? 0) - (conversion.zeroReferenceValue ?? 0);
      const targetSpan = (conversion.nominalTargetValue ?? 0) - (conversion.zeroTargetValue ?? 0);
      return Number.isFinite(referenceSpan) && Number.isFinite(targetSpan) && Math.abs(referenceSpan) > Number.EPSILON && Math.abs(targetSpan) > Number.EPSILON;
    }
    return true;
  }

  static referenceToTarget(referenceValue: number, conversion: ReferenceConversion) {
    if (!Number.isFinite(referenceValue) || !this.validateReferenceConversion(conversion)) throw new Error('Invalid reference conversion.');
    if (conversion.mode === 'load-cell') return (referenceValue - (conversion.zeroReferenceValue ?? 0)) / conversion.sensitivityMvV! * conversion.ratedForceN!;
    if (conversion.mode === 'pulse-flow') return referenceValue * conversion.pulseVolumeCm3! * 60 / 1000;
    if (conversion.mode === 'torque-lever') {
      const appliedForceN = conversion.leverInputKind === 'mass' ? referenceValue * conversion.gravityMs2! : referenceValue;
      const perpendicularFactor = Math.sin((conversion.leverAngleDeg ?? 90) * Math.PI / 180);
      return (conversion.direction ?? 1) * appliedForceN * conversion.leverLengthM! * perpendicularFactor + (conversion.tareTorqueNm ?? 0);
    }
    if (conversion.mode === 'calibrated-signal') {
      const zeroReference = conversion.zeroReferenceValue ?? 0;
      const zeroTarget = conversion.zeroTargetValue ?? 0;
      return zeroTarget + (referenceValue - zeroReference) * (conversion.nominalTargetValue! - zeroTarget) / (conversion.calibratedReferenceValue! - zeroReference);
    }
    if (conversion.mode === 'identity') return referenceValue;
    return referenceValue * conversion.factor + conversion.offset;
  }

  static targetToReference(targetValue: number, conversion: ReferenceConversion) {
    if (!Number.isFinite(targetValue) || !this.validateReferenceConversion(conversion)) throw new Error('Invalid reference conversion.');
    if (conversion.mode === 'load-cell') return (conversion.zeroReferenceValue ?? 0) + targetValue / conversion.ratedForceN! * conversion.sensitivityMvV!;
    if (conversion.mode === 'pulse-flow') return targetValue * 1000 / (conversion.pulseVolumeCm3! * 60);
    if (conversion.mode === 'torque-lever') {
      const perpendicularFactor = Math.sin((conversion.leverAngleDeg ?? 90) * Math.PI / 180);
      const forceN = (targetValue - (conversion.tareTorqueNm ?? 0)) / ((conversion.direction ?? 1) * conversion.leverLengthM! * perpendicularFactor);
      return conversion.leverInputKind === 'mass' ? forceN / conversion.gravityMs2! : forceN;
    }
    if (conversion.mode === 'calibrated-signal') {
      const zeroReference = conversion.zeroReferenceValue ?? 0;
      const zeroTarget = conversion.zeroTargetValue ?? 0;
      return zeroReference + (targetValue - zeroTarget) * (conversion.calibratedReferenceValue! - zeroReference) / (conversion.nominalTargetValue! - zeroTarget);
    }
    if (conversion.mode === 'identity') return targetValue;
    return (targetValue - conversion.offset) / conversion.factor;
  }

  static getCompatibleDataAcquisition(sensor: Sensor, amplifier?: Amplifier): DataAcquisitionDevice[] {
    const signals = amplifier?.bypass ? sensor.outputSignals : amplifier?.supportedSignals ?? sensor.outputSignals;
    return dataAcquisitionDevices.filter(device =>
      device.supportedMeasurands.includes(sensor.measurand)
      && device.supportedSignals.some(signal => signals.includes(signal))
    );
  }

  static isCompatibleChain(
    sensor: Sensor,
    amplifier: Amplifier,
    reference: ReferenceSensor,
    dataAcquisition: DataAcquisitionDevice,
    range: MeasurementRange
  ) {
    return this.getCompatibleAmplifiers(sensor).some(item => item.id === amplifier.id)
      && this.getCompatibleReferences(sensor, range).some(item => item.id === reference.id)
      && this.getCompatibleDataAcquisition(sensor, amplifier).some(item => item.id === dataAcquisition.id);
  }

  static getDefaultMeasurementPoints(sensor: Sensor, range: MeasurementRange): number[] {
    if (sensor.defaultPointValues) return [...sensor.defaultPointValues];
    const percentages = sensor.defaultPointPercentages ?? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    return percentages.map(percent => range.min + range.span * percent / 100);
  }

  static validateMeasurementPoints(points: number[], range: MeasurementRange) {
    if (points.length < 2 || points.length > 50 || points.some(point => !Number.isFinite(point))) return false;
    if (points.some(point => point < range.min || point > range.max)) return false;
    return points.every((point, index) => index === 0 || point > points[index - 1]);
  }

  static getDefaultDisplayResolution(range: MeasurementRange) {
    const defaults: Record<string, number> = {
      bar: 0.01,
      '°C': 0.1,
      N: 1,
      Nm: 0.01,
      rpm: 1,
      'l/min': 0.01,
      '°': 0.1,
      V: 0.001,
      mA: 0.001
    };
    return defaults[range.unit] ?? Math.max(range.span / 10000, 0.001);
  }

  static parseLocalizedNumber(raw: string): number | undefined {
    const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (!normalized || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return undefined;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : undefined;
  }

  static getToleranceStatus(utilizationPercent: number): ToleranceStatus {
    if (!Number.isFinite(utilizationPercent) || utilizationPercent > 100) return 'danger';
    if (utilizationPercent >= 70) return 'warning';
    return 'safe';
  }

  static evaluateMeasurement(sollWert: number, istWert: number, range: MeasurementRange, tolerancePercent: number) {
    if (!Number.isFinite(sollWert) || !Number.isFinite(istWert)) throw new Error('Setpoint and measured value must be finite numbers.');
    if (!Number.isFinite(tolerancePercent) || tolerancePercent <= 0) throw new Error('Tolerance must be greater than zero.');
    const absoluteDeviation = istWert - sollWert;
    const percentageDeviation = absoluteDeviation / range.span * 100;
    const toleranceLimit = range.span * tolerancePercent / 100;
    const toleranceUtilizationPercent = Math.abs(absoluteDeviation) / toleranceLimit * 100;
    const toleranceStatus = this.getToleranceStatus(toleranceUtilizationPercent);
    return {
      absoluteDeviation,
      percentageDeviation,
      toleranceLimit,
      toleranceUtilizationPercent,
      toleranceStatus,
      inTolerance: toleranceUtilizationPercent <= 100 + Number.EPSILON
    };
  }

  private static distributionFactor(distribution: UncertaintyDistribution) {
    return distribution === 'rectangular' ? Math.sqrt(3) : 2;
  }

  static calculateDetailedUncertainty(
    setupOrSensor: CalibrationSetup | Sensor,
    amplifierArg?: Amplifier,
    referenceArg?: ReferenceSensor,
    distributionArg: UncertaintyDistribution = 'normal',
    assumptions: { sensorAgeYears?: number; temperatureDeltaK?: number; range?: MeasurementRange; dataAcquisition?: DataAcquisitionDevice } = {}
  ): UncertaintyBreakdown {
    const isSetup = 'selectedRange' in setupOrSensor;
    const sensor = isSetup ? setupOrSensor.sensor : setupOrSensor;
    const amplifier = isSetup ? setupOrSensor.amplifier : amplifierArg!;
    const reference = isSetup ? setupOrSensor.referenceSensor : referenceArg!;
    const dataAcquisition = isSetup ? setupOrSensor.dataAcquisition : assumptions.dataAcquisition;
    const range = isSetup ? setupOrSensor.selectedRange : assumptions.range;
    const distribution = isSetup ? setupOrSensor.uncertaintyDistribution : distributionArg;
    const age = Math.max(0, isSetup ? setupOrSensor.sensorAgeYears : assumptions.sensorAgeYears ?? 0);
    const temperatureDeltaK = Math.max(0, isSetup ? setupOrSensor.temperatureDeltaK : assumptions.temperatureDeltaK ?? 0);
    const divisor = this.distributionFactor(distribution);
    const coverageFactor = 2;
    const components: UncertaintyBreakdown['components'] = [];

    const add = (id: string, label: string, value: number | undefined, source: string) => {
      if (value === undefined || !Number.isFinite(value) || value <= 0) return;
      components.push({ id, label, expandedPercentFs: value, standardPercentFs: value / divisor, source });
    };
    const addStandard = (id: string, label: string, standardPercentFs: number | undefined, source: string) => {
      if (standardPercentFs === undefined || !Number.isFinite(standardPercentFs) || standardPercentFs <= 0) return;
      components.push({ id, label, expandedPercentFs: standardPercentFs * coverageFactor, standardPercentFs, source });
    };
    const absoluteToPercentFs = (value?: number) => value !== undefined && range ? value / range.span * 100 : undefined;
    const conversion = isSetup ? setupOrSensor.referenceConversion : undefined;
    const referenceRange = conversion
      ? reference.ranges.find(item => item.unit === conversion.referenceUnit)
      : undefined;
    const referenceSpanToTargetSpan = conversion && range && referenceRange && this.validateReferenceConversion(conversion)
      ? Math.abs(
        this.referenceToTarget(referenceRange.max, conversion)
        - this.referenceToTarget(referenceRange.min, conversion)
      ) / range.span
      : 1;
    const referencePercentToTargetPercent = (value?: number) => value === undefined ? undefined : value * referenceSpanToTargetSpan;
    const referenceAbsoluteToTargetPercent = (value?: number) => {
      if (value === undefined || !range || !referenceRange || !conversion) return absoluteToPercentFs(value);
      const targetPerReferenceUnit = Math.abs(
        this.referenceToTarget(referenceRange.max, conversion)
        - this.referenceToTarget(referenceRange.min, conversion)
      ) / referenceRange.span;
      return value * targetPerReferenceUnit / range.span * 100;
    };

    // DUT accuracy and non-linearity define acceptance limits; counting them again as measurement uncertainty would double-count the device under test.
    add('sensor-drift', `Sensor drift (${age.toFixed(1)} years)`, (sensor.accuracy.longTermStabilityPercentSpanPerYear ?? 0) * age, sensor.source.title);
    add('sensor-temperature', `Sensor temperature contribution (${temperatureDeltaK.toFixed(0)} K)`, (sensor.temperatureCompensation?.tempErrorPercentSpanPer10K ?? 0) * temperatureDeltaK / 10, sensor.source.title);
    add('amplifier-gain', 'Amplifier gain error', amplifier?.accuracy.gainErrorPercent, amplifier?.source.title ?? '');
    add('amplifier-temperature', `Amplifier temperature contribution (${temperatureDeltaK.toFixed(0)} K)`, (amplifier?.accuracy.temperatureCoefficientPercentPerK ?? 0) * temperatureDeltaK, amplifier?.source.title ?? '');
    add('reference-accuracy', 'Reference accuracy', reference.accuracy.accuracyPercentFs === undefined
      ? referenceAbsoluteToTargetPercent(reference.accuracy.absoluteAccuracy)
      : referencePercentToTargetPercent(reference.accuracy.accuracyPercentFs), reference.source.title);
    add('reference-linearity', 'Reference non-linearity', referencePercentToTargetPercent(reference.accuracy.nonLinearityPercentFs), reference.source.title);
    add('reference-temperature', `Reference temperature contribution (${temperatureDeltaK.toFixed(0)} K)`, referencePercentToTargetPercent((reference.accuracy.temperatureEffectPercentPer10K ?? 0) * temperatureDeltaK / 10), reference.source.title);
    add('daq-accuracy', 'PC measurement card / DAQ', dataAcquisition?.accuracyPercentFs ?? absoluteToPercentFs(dataAcquisition?.absoluteAccuracy), dataAcquisition?.source.title ?? '');
    if (isSetup && range) {
      const resolution = setupOrSensor.displayResolution ?? this.getDefaultDisplayResolution(range);
      // A digital step q has a rectangular rounding interval of +/-q/2, hence u = q/sqrt(12).
      addStandard('display-resolution', 'Display resolution / least significant digit', resolution / range.span * 100 / Math.sqrt(12), `Readout increment ${resolution} ${range.unit}; rectangular distribution (u = q / sqrt(12))`);
    }
    if (isSetup) (setupOrSensor.additionalUncertainties ?? []).forEach(item => addStandard(`manual-${item.id}`, item.label, item.expandedPercentFs / coverageFactor, item.note || 'Manual test-bench-specific assumption'));

    const combinedStandardUncertainty = Math.sqrt(components.reduce((sum, item) => sum + item.standardPercentFs ** 2, 0));
    return {
      components,
      combinedStandardUncertainty,
      expandedUncertainty: combinedStandardUncertainty * coverageFactor,
      coverageFactor,
      distribution,
      distributionFactor: divisor,
      excludedNotes: ['The UUT base accuracy and non-linearity define the test tolerance and are not added again as measurement uncertainty.', 'Unspecified correlations and repeatability are not included automatically.']
    };
  }

  static calculateTotalUncertainty(setup: CalibrationSetup) {
    return this.calculateDetailedUncertainty(setup).expandedUncertainty;
  }

  /** Conservative decision rule: absolute indication error plus expanded uncertainty must fit inside the tolerance. */
  static passesGuardband(errorPercentFs: number, expandedUncertaintyPercentFs: number, tolerancePercentFs: number) {
    return Math.abs(errorPercentFs) + expandedUncertaintyPercentFs <= tolerancePercentFs + Number.EPSILON;
  }

  static calculateTur(setup: CalibrationSetup, expandedUncertaintyPercentFs = this.calculateTotalUncertainty(setup)): TurAssessment {
    const uutToleranceAbsolute = setup.selectedRange.span * setup.tolerancePercent / 100;
    const calibrationUncertaintyAbsolute = setup.selectedRange.span * expandedUncertaintyPercentFs / 100;
    const ratio = calibrationUncertaintyAbsolute > Number.EPSILON
      ? uutToleranceAbsolute / calibrationUncertaintyAbsolute
      : Number.POSITIVE_INFINITY;
    const requiredRatio = 3;
    return {
      tolerancePercentFs: setup.tolerancePercent,
      calibrationUncertaintyPercentFs: expandedUncertaintyPercentFs,
      uutToleranceAbsolute,
      calibrationUncertaintyAbsolute,
      ratio,
      requiredRatio,
      passes: ratio > requiredRatio,
      unit: setup.selectedRange.unit
    };
  }

  static simulateValue(setpoint: number, range: MeasurementRange, index: number, tolerancePercent: number) {
    const normalized = (setpoint - range.min) / range.span;
    const deterministic = Math.sin((index + 1) * 2.173) * 0.38 + Math.cos((index + 1) * 0.713) * 0.18;
    const offset = 0.12;
    const gain = (normalized - 0.5) * 0.28;
    const deviationPercentFs = (offset + gain + deterministic) * tolerancePercent;
    return setpoint + range.span * deviationPercentFs / 100;
  }

  /** Generates a fresh, bounded simulated reading. The random source is injectable so tests stay deterministic. */
  static simulateRandomValue(setpoint: number, range: MeasurementRange, index: number, tolerancePercent: number, random = Math.random()) {
    const normalized = range.span > 0 ? (setpoint - range.min) / range.span : 0.5;
    const randomComponent = (Math.min(1, Math.max(0, random)) * 2 - 1) * 0.72;
    const repeatableShape = Math.sin((index + 1) * 1.37) * 0.08 + (normalized - 0.5) * 0.12;
    const deviationPercentFs = (randomComponent + repeatableShape) * tolerancePercent;
    return setpoint + range.span * deviationPercentFs / 100;
  }

  static calculateGainAndOffset(measurements: Array<{ sollWert: number; istWert: number }>, fullScaleSpan?: number): GainOffsetResult {
    const n = measurements.length;
    const fallbackSpan = n ? Math.max(...measurements.map(m => m.sollWert)) - Math.min(...measurements.map(m => m.sollWert)) : 0;
    const span = fullScaleSpan && fullScaleSpan > 0 ? fullScaleSpan : fallbackSpan;
    if (n < 2 || span <= 0) return this.identityCorrection(measurements, Math.max(span, 1));
    const xMean = measurements.reduce((sum, m) => sum + m.istWert, 0) / n;
    const yMean = measurements.reduce((sum, m) => sum + m.sollWert, 0) / n;
    const covariance = measurements.reduce((sum, m) => sum + (m.istWert - xMean) * (m.sollWert - yMean), 0);
    const xVariance = measurements.reduce((sum, m) => sum + (m.istWert - xMean) ** 2, 0);
    const yVariance = measurements.reduce((sum, m) => sum + (m.sollWert - yMean) ** 2, 0);
    if (xVariance <= Number.EPSILON) return this.identityCorrection(measurements, span);
    const gain = covariance / xVariance;
    const offset = yMean - gain * xMean;
    const rSquared = yVariance <= Number.EPSILON ? 0 : Math.min(1, Math.max(0, covariance ** 2 / (xVariance * yVariance)));
    const correctedMeasurements = measurements.map(m => {
      const correctedValue = m.istWert * gain + offset;
      const originalDeviation = m.istWert - m.sollWert;
      const correctedDeviation = correctedValue - m.sollWert;
      return { ...m, correctedValue, originalDeviation, correctedDeviation, originalDeviationPercent: originalDeviation / span * 100, correctedDeviationPercent: correctedDeviation / span * 100 };
    });
    const rmse = Math.sqrt(correctedMeasurements.reduce((sum, m) => sum + m.correctedDeviation ** 2, 0) / n);
    return { gain, offset, rSquared, rmse, correctedMeasurements };
  }

  static calculateRecommendedPcSettings(currentGain: number, currentOffset: number, correction: Pick<GainOffsetResult, 'gain' | 'offset'>) {
    if (![currentGain, currentOffset, correction.gain, correction.offset].every(Number.isFinite) || Math.abs(currentGain) <= Number.EPSILON) {
      throw new Error('Current and calculated PC correction values must be finite and the current gain must not be zero.');
    }
    return {
      currentGain,
      currentOffset,
      correctionGain: correction.gain,
      correctionOffset: correction.offset,
      recommendedGain: currentGain * correction.gain,
      recommendedOffset: currentOffset * correction.gain + correction.offset
    };
  }

  private static identityCorrection(measurements: Array<{ sollWert: number; istWert: number }>, span: number): GainOffsetResult {
    const correctedMeasurements = measurements.map(m => {
      const deviation = m.istWert - m.sollWert;
      return { ...m, correctedValue: m.istWert, originalDeviation: deviation, correctedDeviation: deviation, originalDeviationPercent: deviation / span * 100, correctedDeviationPercent: deviation / span * 100 };
    });
    const rmse = correctedMeasurements.length ? Math.sqrt(correctedMeasurements.reduce((sum, m) => sum + m.correctedDeviation ** 2, 0) / correctedMeasurements.length) : 0;
    return { gain: 1, offset: 0, rSquared: 0, rmse, correctedMeasurements };
  }

  static calculateCorrectionStats(data: GainOffsetResult) {
    const originalSigned = data.correctedMeasurements.map(m => m.originalDeviationPercent);
    const correctedSigned = data.correctedMeasurements.map(m => m.correctedDeviationPercent);
    const absAverage = (values: number[]) => values.length ? values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length : 0;
    const standardDeviation = (values: number[]) => {
      if (!values.length) return 0;
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    };
    const originalAvgDeviation = absAverage(originalSigned);
    const correctedAvgDeviation = absAverage(correctedSigned);
    return {
      originalMaxDeviation: originalSigned.length ? Math.max(...originalSigned.map(Math.abs)) : 0,
      correctedMaxDeviation: correctedSigned.length ? Math.max(...correctedSigned.map(Math.abs)) : 0,
      originalAvgDeviation,
      correctedAvgDeviation,
      originalStdDeviation: standardDeviation(originalSigned),
      correctedStdDeviation: standardDeviation(correctedSigned),
      improvementPercent: originalAvgDeviation <= Number.EPSILON ? 0 : (originalAvgDeviation - correctedAvgDeviation) / originalAvgDeviation * 100
    };
  }
}
