import { DataLoader } from './dataLoader';
import { CalibrationSetup, MeasurementRange } from '../types';
import { createAmendmentRecord, mergeBenchCatalog } from './benchStorage';

const bipolarRange: MeasurementRange = { id: 'compound', label: '-10 … +10 bar', measurand: 'pressure', unit: 'bar', kind: 'compound', min: -10, max: 10, span: 20 };

describe('calibration logic', () => {
  test('uses the approved 11-point pressure profiles for 250 and 400 bar', () => {
    const sensor = DataLoader.getSensors().find(item => item.id === 'wika-p30-p31')!;
    const range250 = sensor.ranges.find(item => item.max === 250)!;
    const range400 = sensor.ranges.find(item => item.max === 400)!;
    expect(DataLoader.getDefaultMeasurementPoints(sensor, range250)).toEqual([0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250]);
    expect(DataLoader.getDefaultMeasurementPoints(sensor, range400)).toEqual([0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400]);
  });

  test('uses the explicit temperature register profile from 10 to 150 degrees', () => {
    const sensor = DataLoader.getSensors().find(item => item.measurand === 'temperature')!;
    expect(DataLoader.getDefaultMeasurementPoints(sensor, sensor.ranges[0])).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]);
  });

  test('filters references by measurand and selected range', () => {
    const pressureSensor = DataLoader.getSensors().find(item => item.id === 'wika-p30-p31')!;
    const range400 = pressureSensor.ranges.find(item => item.max === 400)!;
    const compatible = DataLoader.getCompatibleReferences(pressureSensor, range400);
    expect(compatible.map(item => item.id)).toEqual(expect.arrayContaining(['fluke-2700g-700', 'wika-cpg1500-400']));
    expect(compatible.map(item => item.id)).not.toContain('hbk-k3607');
    expect(compatible.every(item => item.ranges.some(range => range.max >= 400))).toBe(true);
  });

  test('classifies tolerance utilization at the 70 and 100 percent boundaries', () => {
    expect(DataLoader.getToleranceStatus(69.999)).toBe('safe');
    expect(DataLoader.getToleranceStatus(70)).toBe('warning');
    expect(DataLoader.getToleranceStatus(100)).toBe('warning');
    expect(DataLoader.getToleranceStatus(100.001)).toBe('danger');
    const positive = DataLoader.evaluateMeasurement(0, 0.7, bipolarRange, 5);
    const negative = DataLoader.evaluateMeasurement(0, -0.7, bipolarRange, 5);
    expect(positive.toleranceUtilizationPercent).toBeCloseTo(70);
    expect(negative.toleranceStatus).toBe(positive.toleranceStatus);
  });

  test('evaluates the zero point against full-scale tolerance', () => {
    const result = DataLoader.evaluateMeasurement(0, 1, bipolarRange, 0.2);
    expect(result.percentageDeviation).toBeCloseTo(5);
    expect(result.inTolerance).toBe(false);
    expect(result.toleranceLimit).toBeCloseTo(0.04);
  });

  test('accepts German decimal comma and rejects ambiguous input', () => {
    expect(DataLoader.parseLocalizedNumber('250,02')).toBeCloseTo(250.02);
    expect(DataLoader.parseLocalizedNumber('-0.25')).toBeCloseTo(-0.25);
    expect(DataLoader.parseLocalizedNumber('1.234,5')).toBeUndefined();
    expect(DataLoader.parseLocalizedNumber('')).toBeUndefined();
  });

  test('validates editable point lists as ordered, unique and in range', () => {
    expect(DataLoader.validateMeasurementPoints([-10, 0, 10], bipolarRange)).toBe(true);
    expect(DataLoader.validateMeasurementPoints([-10, 0, 0, 10], bipolarRange)).toBe(false);
    expect(DataLoader.validateMeasurementPoints([-11, 0, 10], bipolarRange)).toBe(false);
  });

  test('applies a conservative guardband decision', () => {
    expect(DataLoader.passesGuardband(0.04, 0.05, 0.1)).toBe(true);
    expect(DataLoader.passesGuardband(0.06, 0.05, 0.1)).toBe(false);
  });

  test('simulation is deterministic and remains near the configured tolerance', () => {
    const first = DataLoader.simulateValue(0, bipolarRange, 0, 0.1);
    expect(DataLoader.simulateValue(0, bipolarRange, 0, 0.1)).toBe(first);
    expect(Number.isFinite(first)).toBe(true);
  });

  test('derives offset and gain in the correct direction', () => {
    const targets = [-10, -5, 0, 5, 10];
    const measurements = targets.map(sollWert => ({ sollWert, istWert: sollWert * 1.1 + 1 }));
    const correction = DataLoader.calculateGainAndOffset(measurements, bipolarRange.span);
    expect(correction.gain).toBeCloseTo(1 / 1.1, 10);
    expect(correction.offset).toBeCloseTo(-1 / 1.1, 10);
    correction.correctedMeasurements.forEach((point, index) => expect(point.correctedValue).toBeCloseTo(targets[index], 10));
  });

  test('composes the calculated correction with the currently configured PC gain and offset', () => {
    const settings = DataLoader.calculateRecommendedPcSettings(1.25, 3, { gain: 0.8, offset: -2 });
    expect(settings.recommendedGain).toBeCloseTo(1);
    expect(settings.recommendedOffset).toBeCloseTo(0.4);
    const rawValue = 10;
    const oldDisplayedValue = rawValue * settings.currentGain + settings.currentOffset;
    const correctedOldValue = oldDisplayedValue * settings.correctionGain + settings.correctionOffset;
    const displayedWithNewSettings = rawValue * settings.recommendedGain + settings.recommendedOffset;
    expect(displayedWithNewSettings).toBeCloseTo(correctedOldValue, 12);
    expect(() => DataLoader.calculateRecommendedPcSettings(0, 0, { gain: 1, offset: 0 })).toThrow();
  });

  test('includes DAQ, age and temperature in uncertainty', () => {
    const sensor = DataLoader.getSensors()[0];
    const amplifier = DataLoader.getCompatibleAmplifiers(sensor)[0];
    const range = sensor.ranges.find(item => item.max === 400)!;
    const reference = DataLoader.getCompatibleReferences(sensor, range)[0];
    const daq = DataLoader.getCompatibleDataAcquisition(sensor, amplifier)[0];
    const baseline = DataLoader.calculateDetailedUncertainty(sensor, amplifier, reference, 'normal', { range, dataAcquisition: daq });
    const stressed = DataLoader.calculateDetailedUncertainty(sensor, amplifier, reference, 'normal', { range, dataAcquisition: daq, sensorAgeYears: 2, temperatureDeltaK: 10 });
    expect(stressed.expandedUncertainty).toBeGreaterThan(baseline.expandedUncertainty);
    expect(stressed.components.some(component => component.id === 'daq-accuracy')).toBe(true);
    expect(stressed.components.some(component => component.id === 'sensor-drift')).toBe(true);
  });

  test('adds manual bench influences transparently to the uncertainty budget', () => {
    const sensor = DataLoader.getSensors().find(item => item.id === 'internal-torque-sensor-200nm')!;
    const amplifier = DataLoader.getCompatibleAmplifiers(sensor)[0];
    const range = sensor.ranges[0];
    const reference = DataLoader.getCompatibleReferences(sensor, range)[0];
    const dataAcquisition = DataLoader.getCompatibleDataAcquisition(sensor, amplifier)[0];
    const setup = { sensor, amplifier, referenceSensor: reference, dataAcquisition, selectedRange: range, uncertaintyDistribution: 'normal', sensorAgeYears: 0, temperatureDeltaK: 0, displayResolution: 0.01, tolerancePercent: 0.2, additionalUncertainties: [] } as unknown as CalibrationSetup;
    const baseline = DataLoader.calculateDetailedUncertainty(setup);
    const extended = DataLoader.calculateDetailedUncertainty({ ...setup, additionalUncertainties: [{ id: 'lever', label: 'Lever position', expandedPercentFs: 0.05 }] });
    expect(extended.expandedUncertainty).toBeGreaterThan(baseline.expandedUncertainty);
    expect(extended.components.find(component => component.label === 'Lever position')?.source).toContain('Manual');
  });

  test('keeps a manually entered expanded uncertainty unchanged for every distribution', () => {
    const sensor = DataLoader.getSensors().find(item => item.id === 'internal-torque-sensor-200nm')!;
    const amplifier = DataLoader.getCompatibleAmplifiers(sensor)[0];
    const range = sensor.ranges[0];
    const referenceSensor = DataLoader.getCompatibleReferences(sensor, range)[0];
    const dataAcquisition = DataLoader.getCompatibleDataAcquisition(sensor, amplifier)[0];
    const setup = { sensor, amplifier, referenceSensor, dataAcquisition, selectedRange: range, referenceConversion: DataLoader.getTestBenches()[2].measurementPaths[0].conversion, uncertaintyDistribution: 'rectangular', sensorAgeYears: 0, temperatureDeltaK: 0, displayResolution: 0.01, tolerancePercent: 0.2, additionalUncertainties: [{ id: 'lever', label: 'Lever position', expandedPercentFs: 0.05 }] } as unknown as CalibrationSetup;
    const component = DataLoader.calculateDetailedUncertainty(setup).components.find(item => item.id === 'manual-lever')!;
    expect(component.standardPercentFs).toBeCloseTo(0.025, 12);
    expect(component.expandedPercentFs).toBeCloseTo(0.05, 12);
  });

  test('converts reference full-scale accuracy into the target measurement range', () => {
    const path = DataLoader.getTestBenches().find(item => item.id === 'pb-02-multisensor')!.measurementPaths.find(item => item.id === 'pb02-angle')!;
    const sensor = DataLoader.getSensors().find(item => item.id === path.sensorId)!;
    const selectedRange = sensor.ranges.find(item => item.id === path.rangeId)!;
    const amplifier = DataLoader.getAmplifiers().find(item => item.id === path.amplifierId)!;
    const referenceSensor = DataLoader.getReferenceSensors().find(item => item.id === path.referenceId)!;
    const dataAcquisition = DataLoader.getDataAcquisitionDevices().find(item => item.id === path.dataAcquisitionId)!;
    const setup = { sensor, amplifier, referenceSensor, dataAcquisition, selectedRange, referenceConversion: path.conversion, uncertaintyDistribution: 'normal', sensorAgeYears: 0, temperatureDeltaK: 0, displayResolution: 0.1, tolerancePercent: path.tolerancePercent, additionalUncertainties: [] } as unknown as CalibrationSetup;
    const referenceAccuracy = DataLoader.calculateDetailedUncertainty(setup).components.find(item => item.id === 'reference-accuracy')!;
    expect(referenceAccuracy.expandedPercentFs).toBeCloseTo(0.02, 12);
  });

  test('adds the physical display resolution as a rectangular readout contribution', () => {
    const sensor = DataLoader.getSensors().find(item => item.id === 'internal-torque-sensor-200nm')!;
    const amplifier = DataLoader.getCompatibleAmplifiers(sensor)[0];
    const range = sensor.ranges[0];
    const reference = DataLoader.getCompatibleReferences(sensor, range)[0];
    const dataAcquisition = DataLoader.getCompatibleDataAcquisition(sensor, amplifier)[0];
    const base = { sensor, amplifier, referenceSensor: reference, dataAcquisition, selectedRange: range, uncertaintyDistribution: 'normal' as const, sensorAgeYears: 0, temperatureDeltaK: 0, tolerancePercent: 0.2, additionalUncertainties: [] } as unknown as CalibrationSetup;
    const fine = DataLoader.calculateDetailedUncertainty({ ...base, displayResolution: 0.001 });
    const coarse = DataLoader.calculateDetailedUncertainty({ ...base, displayResolution: 1 });
    const contribution = coarse.components.find(component => component.id === 'display-resolution');
    expect(contribution?.standardPercentFs).toBeCloseTo(1 / range.span * 100 / Math.sqrt(12), 10);
    expect(contribution?.source).toContain('q / sqrt(12)');
    expect(coarse.expandedUncertainty).toBeGreaterThan(fine.expandedUncertainty);
  });

  test('calculates TUR in physical units and requires a ratio strictly greater than three', () => {
    const setup = { selectedRange: { ...bipolarRange, min: 0, max: 400, span: 400, unit: 'bar' }, tolerancePercent: 0.1 } as unknown as CalibrationSetup;
    const passing = DataLoader.calculateTur(setup, 0.025);
    const boundary = DataLoader.calculateTur(setup, 0.1 / 3);
    const failing = DataLoader.calculateTur(setup, 0.1);
    expect(passing.uutToleranceAbsolute).toBeCloseTo(0.4);
    expect(passing.calibrationUncertaintyAbsolute).toBeCloseTo(0.1);
    expect(passing.ratio).toBeCloseTo(4);
    expect(passing.passes).toBe(true);
    expect(boundary.ratio).toBeCloseTo(3);
    expect(boundary.passes).toBe(false);
    expect(failing.ratio).toBeCloseTo(1);
    expect(failing.passes).toBe(false);
  });

  test('converts calibrated load-cell sensitivity bidirectionally', () => {
    const conversion = { mode: 'load-cell' as const, referenceUnit: 'mV/V', targetUnit: 'N', factor: 1, offset: 0, ratedForceN: 100000, sensitivityMvV: 2.01, zeroReferenceValue: 0, description: 'fixture' };
    expect(DataLoader.referenceToTarget(2.01, conversion)).toBeCloseTo(100000, 10);
    expect(DataLoader.targetToReference(50000, conversion)).toBeCloseTo(1.005, 10);
    expect(DataLoader.referenceToTarget(DataLoader.targetToReference(77777, conversion), conversion)).toBeCloseTo(77777, 8);
  });

  test('converts turbine frequency and pulse volume bidirectionally', () => {
    const conversion = { mode: 'pulse-flow' as const, referenceUnit: 'Hz', targetUnit: 'l/min', factor: 1, offset: 0, pulseVolumeCm3: 0.05, description: 'fixture' };
    expect(DataLoader.referenceToTarget(1000, conversion)).toBeCloseTo(3, 10);
    expect(DataLoader.targetToReference(30, conversion)).toBeCloseTo(10000, 10);
    expect(DataLoader.referenceToTarget(DataLoader.targetToReference(12.5, conversion), conversion)).toBeCloseTo(12.5, 10);
  });

  test('converts a generic affine reference without mixing it with DUT correction', () => {
    const conversion = { mode: 'linear' as const, referenceUnit: 'mA', targetUnit: 'bar', factor: 25, offset: -100, description: '4-20 mA to 0-400 bar' };
    expect(DataLoader.referenceToTarget(4, conversion)).toBeCloseTo(0);
    expect(DataLoader.referenceToTarget(20, conversion)).toBeCloseTo(400);
    expect(DataLoader.targetToReference(200, conversion)).toBeCloseTo(12);
  });

  test('derives torque from force, lever length, angle, direction and tare', () => {
    const conversion = { mode: 'torque-lever' as const, referenceUnit: 'N', targetUnit: 'Nm', factor: 1, offset: 0, leverLengthM: 0.5, leverInputKind: 'force' as const, gravityMs2: 9.80665, leverAngleDeg: 90, direction: 1 as const, tareTorqueNm: 0, description: 'fixture' };
    expect(DataLoader.referenceToTarget(50, conversion)).toBeCloseTo(25, 10);
    expect(DataLoader.targetToReference(25, conversion)).toBeCloseTo(50, 10);
    expect(DataLoader.referenceToTarget(200, { ...conversion, leverAngleDeg: 30 })).toBeCloseTo(50, 10);
    expect(DataLoader.referenceToTarget(50, { ...conversion, direction: -1, tareTorqueNm: 2 })).toBeCloseTo(-23, 10);
  });

  test('supports mass-based torque using configurable gravity', () => {
    const conversion = { mode: 'torque-lever' as const, referenceUnit: 'kg', targetUnit: 'Nm', factor: 1, offset: 0, leverLengthM: 0.5, leverInputKind: 'mass' as const, gravityMs2: 9.80665, leverAngleDeg: 90, direction: 1 as const, tareTorqueNm: 0, description: 'fixture' };
    expect(DataLoader.referenceToTarget(5, conversion)).toBeCloseTo(24.516625, 8);
    expect(DataLoader.targetToReference(24.516625, conversion)).toBeCloseTo(5, 8);
  });

  test('keeps electrical simulator inputs round and derives precise torque targets', () => {
    const conversion = { mode: 'calibrated-signal' as const, referenceUnit: 'V', targetUnit: 'Nm', factor: 1, offset: 0, zeroReferenceValue: 0, zeroTargetValue: 0, calibratedReferenceValue: 10.01, nominalTargetValue: 200, description: 'fixture' };
    expect(DataLoader.referenceToTarget(10, conversion)).toBeCloseTo(199.8001998, 7);
    expect(DataLoader.referenceToTarget(0.1, conversion)).toBeCloseTo(1.998001998, 7);
    expect(DataLoader.referenceToTarget(10.01, conversion)).toBeCloseTo(200, 10);
    expect(DataLoader.targetToReference(DataLoader.referenceToTarget(7, conversion), conversion)).toBeCloseTo(7, 10);
  });

  test('provides a multi-sensor bench with stable path installation attributes', () => {
    const bench = DataLoader.getTestBenches().find(item => item.id === 'pb-02-multisensor')!;
    expect(bench.measurementPaths).toHaveLength(5);
    expect(bench.measurementPaths.map(item => item.measurand)).toEqual(['force', 'flow', 'temperature', 'voltage', 'angle']);
    expect(bench.measurementPaths.every(item => item.sensorBmk && item.connector && item.dataAcquisitionBmk && item.dataAcquisitionChannel)).toBe(true);
  });

  test('provides a torque bench with simple physical reference points', () => {
    const bench = DataLoader.getTestBenches().find(item => item.id === 'pb-03-torque')!;
    const path = bench.measurementPaths[0];
    expect(path.measurand).toBe('torque');
    expect(path.referencePointValues).toEqual([0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400]);
    expect(path.referencePointValues!.map(value => DataLoader.referenceToTarget(value, path.conversion))).toEqual([0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200]);
  });

  test('models torque, angle and speed as three outputs of one physical sensor', () => {
    const bench = DataLoader.getTestBenches().find(item => item.id === 'pb-03-torque')!;
    expect(bench.measurementPaths).toHaveLength(3);
    expect(bench.measurementPaths.map(item => item.measurand)).toEqual(['torque', 'angle', 'speed']);
    expect(new Set(bench.measurementPaths.map(item => item.physicalSensorId)).size).toBe(1);
  });

  test('merges edited built-in benches without duplicating them', () => {
    const builtIn = DataLoader.getTestBenches();
    const extraPath = { ...builtIn[0].measurementPaths[0], id: 'added-path', name: 'Additional measurement path' };
    const override = { ...builtIn[0], measurementPaths: [...builtIn[0].measurementPaths, extraPath] };
    const custom = { ...builtIn[1], id: 'custom-bench', name: 'Eigener Test bench', source: 'local' as const };
    const merged = mergeBenchCatalog(builtIn, [override, custom]);
    expect(merged.filter(bench => bench.id === builtIn[0].id)).toHaveLength(1);
    expect(merged.find(bench => bench.id === builtIn[0].id)?.measurementPaths).toHaveLength(3);
    expect(merged.some(bench => bench.id === custom.id)).toBe(true);
  });

  test('preserves template governance and creates attributable amendment records', () => {
    const builtIn = DataLoader.getTestBenches();
    const timestamp = new Date('2026-08-12T10:30:00.000Z');
    const amendment = createAmendmentRecord('  Alex Smith  ', 'locked', '  Approved after review.  ', ' Issue 3 ', timestamp);
    const override = { ...builtIn[0], locked: true, amendmentHistory: [amendment] };
    const merged = mergeBenchCatalog(builtIn, [override]);
    expect(amendment.author).toBe('Alex Smith');
    expect(amendment.note).toBe('Approved after review.');
    expect(amendment.issue).toBe('Issue 3');
    expect(amendment.timestamp).toBe(timestamp.toISOString());
    expect(merged[0].locked).toBe(true);
    expect(merged[0].amendmentHistory).toEqual([amendment]);
  });

  test('creates fresh but bounded random simulation values with an injectable source', () => {
    const range = { id: 'fixture', label: '0…100 bar', min: 0, max: 100, span: 100, unit: 'bar' as const, kind: 'pressure' as const, measurand: 'pressure' as const };
    const low = DataLoader.simulateRandomValue(50, range, 0, 1, 0);
    const high = DataLoader.simulateRandomValue(50, range, 0, 1, 1);
    expect(low).not.toBe(high);
    expect(Math.abs(low - 50)).toBeLessThan(1);
    expect(Math.abs(high - 50)).toBeLessThan(1);
  });
});
