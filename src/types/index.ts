// Sensor Types
export interface Sensor {
  manufacturer: string;
  datasheet: string;
  models: string[];
  sensor_type: string;
  measurement_ranges: {
    relative_pressure_bar?: number[];
    absolute_pressure_bar?: number[];
    vacuum_bar?: string[];
    "+/-_pressure_bar"?: string[];
  };
  accuracy: {
    standard_span_percent: number;
    optional_span_percent?: number;
    nonlinearity_span_percent_bfsl?: number;
    long_term_stability_percent_span_per_year?: number;
  };
  temperature_compensation?: {
    compensated_range_celsius: number[];
    no_additional_error_range_celsius?: number[];
    temp_error_percent_span_per_10K?: number;
  };
  output_signals: string[];
  supply_voltage_vdc?: Record<string, string>;
  measurement_rate_ms?: Record<string, number>;
  overload_safety?: Record<string, string>;
  environment?: {
    protection_classes?: Record<string, string>;
    operating_temperature_celsius?: number[];
    medium_temperature_celsius?: number[];
    storage_temperature_celsius?: number[];
    vibration_g?: number;
    shock_g?: number;
  };
}

// Amplifier Types
export interface Amplifier {
  manufacturer: string;
  datasheet: string;
  models: string[];
  device_type: string;
  input_ranges: {
    voltage_V?: number[];
    current_mA?: number[];
    special?: string[];
  };
  output_ranges: {
    current_mA?: string[];
    voltage_V?: string[];
  };
  accuracy: {
    gain_error_percent: number;
    temperature_coefficient_percent_per_K?: number;
    offset_current_uA?: number;
    offset_voltage_mV?: number;
    ripple_mV_eff?: string;
  };
  bandwidth?: {
    high_cutoff_kHz?: number;
    low_cutoff_Hz?: number;
    step_response_T90_us?: number;
  };
  load_limits?: {
    current_output?: string;
    voltage_output?: string;
  };
  supply?: {
    voltage_range_V_AC_DC?: number[];
    frequency_Hz_AC?: number[];
    power_consumption_AC_VA?: number;
    power_consumption_DC_W?: number;
  };
  isolation?: {
    ports?: number;
    test_voltage_kV_AC?: Record<string, number>;
    working_voltage_V?: number;
  };
  environment?: {
    operating_temperature_C?: number[];
    storage_temperature_C?: number[];
    relative_humidity_percent?: number[];
    altitude_m?: number;
  };
  mechanical?: {
    dimensions_mm?: {
      width: number;
      height: number;
      depth: number;
    };
    weight_g?: number;
    mounting?: string;
  };
}

// Reference Sensor Types
export interface ReferenceSensor {
  manufacturer: string;
  datasheet: string;
  models: string[];
  device_type: string;
  calibration_signals?: {
    range_steps_mV_per_V?: number[];
    percentage_steps_percent?: number[];
    overall_span_mV_per_V?: number[];
  };
  accuracy: {
    accuracy_class?: number;
    range_step_error_percent_fs?: number;
    percentage_step_error_percent?: number;
    absolute_zero_error_mV_per_V?: number;
    non_linearity_percent_fs?: number;
    temperature_effect_percent_per_10K_service?: number;
    temperature_effect_percent_per_10K_nominal?: number;
  };
  excitation_frequency_hz?: number[];
  bridge_equivalent?: {
    resistance_ohms?: number;
  };
  supply_voltage_v?: {
    nominal?: number;
    maximum?: number;
  };
  environment?: {
    nominal_temperature_c?: number[];
    service_temperature_c?: number[];
    storage_temperature_c?: number[];
  };
  mechanical?: {
    weight_kg?: number;
    dimensions_mm?: number[];
  };
  features?: string[];
}

// Uncertainty Distribution Types
export type UncertaintyDistribution = 'rectangular' | 'normal';

// Calibration Types
export interface CalibrationSetup {
  sensor: Sensor;
  amplifier: Amplifier;
  referenceSensor: ReferenceSensor;
  selectedSensorModel: string;
  selectedAmplifierModel: string;
  selectedReferenceModel: string;
  selectedPressureRange: number | string;
  tolerancePercent: number;
  measurementPoints: number;
  uncertaintyDistribution: UncertaintyDistribution;
}

export interface MeasurementPoint {
  id: number;
  sollWert: number;
  istWert: number;
  abweichung: number;
  abweichungPercent: number;
  inToleranz: boolean;
  timestamp: Date;
}

export interface CalibrationResult {
  setup: CalibrationSetup;
  measurements: MeasurementPoint[];
  totalUncertainty: number;
  passed: boolean;
  createdAt: Date;
  technician?: string;
}

// UI State Types
export interface AppState {
  currentStep: 'dashboard' | 'setup' | 'calibration' | 'results';
  calibrationSetup?: CalibrationSetup;
  currentMeasurement: number;
  measurements: MeasurementPoint[];
  calibrationResults: CalibrationResult[];
  canAccessSteps: {
    setup: boolean;
    calibration: boolean;
    results: boolean;
  };
} 