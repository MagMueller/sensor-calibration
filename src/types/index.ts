export type Measurand = 'pressure' | 'temperature' | 'force' | 'torque' | 'speed' | 'flow' | 'angle' | 'voltage' | 'current' | 'electrical';
export type ToleranceStatus = 'safe' | 'warning' | 'danger';
export type UncertaintyDistribution = 'rectangular' | 'normal';

export interface DatasheetSource {
  title: string;
  url: string;
  status: 'manufacturer' | 'internal';
  note?: string;
}

export interface MeasurementRange {
  id: string;
  label: string;
  measurand: Measurand;
  unit: 'bar' | '°C' | '%' | 'N' | 'Nm' | 'rpm' | 'kg' | 'l/min' | '°' | 'V' | 'mA' | 'Hz' | 'mV/V';
  min: number;
  max: number;
  span: number;
  kind: string;
  preferred?: boolean;
}

export interface Sensor {
  id: string;
  manufacturer: string;
  models: string[];
  sensorType: string;
  measurand: Measurand;
  ranges: MeasurementRange[];
  preferredRangeIds: string[];
  defaultTolerancePercentFs: number;
  defaultPointPercentages?: number[];
  defaultPointValues?: number[];
  accuracy: {
    standardSpanPercent: number;
    optionalSpanPercent?: number;
    nonlinearitySpanPercentBfsl?: number;
    longTermStabilityPercentSpanPerYear?: number;
  };
  temperatureCompensation?: {
    compensatedRangeCelsius: number[];
    noAdditionalErrorRangeCelsius?: number[];
    tempErrorPercentSpanPer10K?: number;
  };
  outputSignals: string[];
  source: DatasheetSource;
}

export interface Amplifier {
  id: string;
  manufacturer: string;
  models: string[];
  deviceType: string;
  supportedMeasurands: Measurand[];
  supportedSignals: string[];
  bypass?: boolean;
  accuracy: {
    gainErrorPercent: number;
    temperatureCoefficientPercentPerK?: number;
  };
  source: DatasheetSource;
}

export interface ReferenceSensor {
  id: string;
  manufacturer: string;
  models: string[];
  deviceType: string;
  measurand: Measurand;
  supportedTargetMeasurands?: Measurand[];
  ranges: MeasurementRange[];
  accuracy: {
    accuracyPercentFs?: number;
    absoluteAccuracy?: number;
    nonLinearityPercentFs?: number;
    temperatureEffectPercentPer10K?: number;
  };
  source: DatasheetSource;
}

export type ReferenceConversionMode = 'identity' | 'linear' | 'load-cell' | 'pulse-flow' | 'torque-lever' | 'calibrated-signal';

export interface ReferenceConversion {
  mode: ReferenceConversionMode;
  referenceUnit: string;
  targetUnit: string;
  factor: number;
  offset: number;
  ratedForceN?: number;
  sensitivityMvV?: number;
  zeroReferenceValue?: number;
  pulseVolumeCm3?: number;
  leverLengthM?: number;
  leverInputKind?: 'force' | 'mass';
  gravityMs2?: number;
  leverAngleDeg?: number;
  direction?: 1 | -1;
  tareTorqueNm?: number;
  zeroTargetValue?: number;
  nominalTargetValue?: number;
  calibratedReferenceValue?: number;
  description: string;
}

export interface AdditionalUncertainty {
  id: string;
  label: string;
  /** User-supplied expanded uncertainty in percent of the configured full-scale span. */
  expandedPercentFs: number;
  note?: string;
}

export interface MeasurementPath {
  id: string;
  name: string;
  physicalSensorId?: string;
  physicalSensorName?: string;
  measurand: Measurand;
  sensorId: string;
  sensorModel: string;
  rangeId: string;
  amplifierId: string;
  amplifierModel: string;
  referenceId: string;
  referenceModel: string;
  dataAcquisitionId: string;
  dataAcquisitionModel: string;
  sensorBmk: string;
  connector: string;
  amplifierBmk: string;
  amplifierChannel: string;
  dataAcquisitionBmk?: string;
  dataAcquisitionChannel: string;
  conversion: ReferenceConversion;
  tolerancePercent: number;
  /** Smallest readable step of the PC indication in the physical target unit. */
  displayResolution?: number;
  /** Currently configured linear scaling in the PC: displayed value = raw value * gain + offset. */
  pcGain?: number;
  pcOffset?: number;
  rangeMin?: number;
  rangeMax?: number;
  pointValues?: number[];
  /** Preferred values entered at the physical reference. These deliberately stay simple; engineering setpoints are derived from them. */
  referencePointValues?: number[];
  additionalUncertainties?: AdditionalUncertainty[];
}

export type AmendmentAction =
  | 'created'
  | 'measurement-path-added'
  | 'measurement-path-removed'
  | 'configuration-changed'
  | 'locked'
  | 'unlocked';

export interface AmendmentRecord {
  id: string;
  timestamp: string;
  author: string;
  action: AmendmentAction;
  note: string;
  issue: string;
}

export interface TestBench {
  id: string;
  name: string;
  revision: string;
  description: string;
  measurementPaths: MeasurementPath[];
  source: 'built-in' | 'local';
  /** Workflow lock for local template editing. This is not a server-enforced immutable lock. */
  locked?: boolean;
  amendmentHistory?: AmendmentRecord[];
}

export interface DataAcquisitionDevice {
  id: string;
  manufacturer: string;
  models: string[];
  deviceType: string;
  supportedMeasurands: Measurand[];
  supportedSignals: string[];
  accuracyPercentFs?: number;
  absoluteAccuracy?: number;
  resolutionBits: number;
  source: DatasheetSource;
}

export interface CalibrationSetup {
  runMode: 'calibration' | 'simulation';
  testBenchId: string;
  testBenchName: string;
  measurementPathId: string;
  measurementPathName: string;
  sensorBmk: string;
  connector: string;
  amplifierBmk: string;
  amplifierChannel: string;
  dataAcquisitionBmk: string;
  dataAcquisitionChannel: string;
  referenceConversion: ReferenceConversion;
  sensor: Sensor;
  amplifier: Amplifier;
  referenceSensor: ReferenceSensor;
  dataAcquisition: DataAcquisitionDevice;
  selectedSensorModel: string;
  selectedAmplifierModel: string;
  selectedReferenceModel: string;
  selectedDataAcquisitionModel: string;
  sensorSerial: string;
  amplifierSerial: string;
  referenceSerial: string;
  dataAcquisitionSerial: string;
  selectedRange: MeasurementRange;
  measurementPointValues: number[];
  referencePointValues: number[];
  tolerancePercent: number;
  /** Smallest readable step of the PC indication in the physical target unit. */
  displayResolution: number;
  /** Currently configured linear scaling in the PC: displayed value = raw value * gain + offset. */
  pcGain: number;
  pcOffset: number;
  uncertaintyDistribution: UncertaintyDistribution;
  sensorAgeYears: number;
  temperatureDeltaK: number;
  additionalUncertainties: AdditionalUncertainty[];
  protocolIssue: string;
  amendmentNote: string;
  technician: string;
  templateLocked: boolean;
  /** Snapshot of the template history at the time the calibration was started. */
  templateAmendmentHistory: AmendmentRecord[];
}

export interface MeasurementPoint {
  id: number;
  sollWert: number;
  referenceSetpoint: number;
  istWert: number;
  abweichung: number;
  /** Deviation in percent of full-scale span, not percent of the setpoint. */
  abweichungPercent: number;
  toleranceLimit: number;
  toleranceUtilizationPercent: number;
  toleranceStatus: ToleranceStatus;
  inToleranz: boolean;
  timestamp: Date;
}

export interface CalibrationResult {
  setup: CalibrationSetup;
  measurements: MeasurementPoint[];
  totalUncertainty: number;
  passed: boolean;
  createdAt: Date;
  /** Optional only for backward compatibility with records created before traceability was added. */
  technician?: string;
}

export interface UncertaintyComponent {
  id: string;
  label: string;
  expandedPercentFs: number;
  standardPercentFs: number;
  source: string;
}

export interface UncertaintyBreakdown {
  components: UncertaintyComponent[];
  combinedStandardUncertainty: number;
  expandedUncertainty: number;
  coverageFactor: number;
  distribution: UncertaintyDistribution;
  distributionFactor: number;
  excludedNotes: string[];
}

export interface TurAssessment {
  tolerancePercentFs: number;
  calibrationUncertaintyPercentFs: number;
  uutToleranceAbsolute: number;
  calibrationUncertaintyAbsolute: number;
  ratio: number;
  requiredRatio: number;
  passes: boolean;
  unit: string;
}

export interface GainOffsetResult {
  gain: number;
  offset: number;
  rSquared: number;
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
}

export interface AppState {
  currentStep: 'overview' | 'setup' | 'calibration' | 'results';
  setupBenchId?: string;
  calibrationSetup?: CalibrationSetup;
  calibrationQueue: CalibrationSetup[];
  currentRunResults: CalibrationResult[];
  calibrationResults: CalibrationResult[];
  canAccessSteps: {
    setup: boolean;
    calibration: boolean;
    results: boolean;
  };
}
