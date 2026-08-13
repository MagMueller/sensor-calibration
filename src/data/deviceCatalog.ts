import { Amplifier, DataAcquisitionDevice, MeasurementRange, ReferenceSensor, Sensor } from '../types';

const pressureRange = (max: number, preferred = false): MeasurementRange => ({
  id: `pressure-relative-0-${max}`,
  label: `0 … ${max} bar · Gauge pressure`,
  measurand: 'pressure',
  unit: 'bar',
  min: 0,
  max,
  span: max,
  kind: 'relative',
  preferred
});

const temperatureRegisterRange: MeasurementRange = {
  id: 'temperature-register-10-150',
  label: '10 … 150 °C · Temperature register',
  measurand: 'temperature',
  unit: '°C',
  min: 10,
  max: 150,
  span: 140,
  kind: 'temperature-register',
  preferred: true
};

const engineeringRange = (id: string, label: string, measurand: MeasurementRange['measurand'], unit: MeasurementRange['unit'], min: number, max: number): MeasurementRange => ({
  id, label, measurand, unit, min, max, span: max - min, kind: measurand, preferred: true
});

const pressureRanges = [
  pressureRange(250, true),
  pressureRange(400, true),
  ...[0.25, 0.4, 0.6, 1, 1.6, 2.5, 4, 6, 10, 16, 25, 40, 60, 100, 160, 600, 1000]
    .map(value => pressureRange(value))
];

export const sensors: Sensor[] = [
  {
    id: 'wika-p30-p31',
    manufacturer: 'WIKA',
    models: ['P-30', 'P-31'],
    sensorType: 'Precision pressure sensor',
    measurand: 'pressure',
    ranges: pressureRanges,
    preferredRangeIds: ['pressure-relative-0-250', 'pressure-relative-0-400'],
    defaultTolerancePercentFs: 0.1,
    defaultPointPercentages: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    accuracy: {
      standardSpanPercent: 0.1,
      optionalSpanPercent: 0.05,
      nonlinearitySpanPercentBfsl: 0.04,
      longTermStabilityPercentSpanPerYear: 0.1
    },
    temperatureCompensation: {
      compensatedRangeCelsius: [-20, 80],
      noAdditionalErrorRangeCelsius: [10, 60],
      tempErrorPercentSpanPer10K: 0.2
    },
    outputSignals: ['4-20 mA', '0-20 mA', '0-5 V', '0-10 V', 'USB', 'CANopen'],
    source: {
      title: 'WIKA PE 81.54 · P-30/P-31',
      url: 'https://www.wika.com/media/Data-sheets/Pressure/Pressure-sensors/ds_pe8154_de_de.pdf',
      status: 'manufacturer',
      note: 'Standard accuracy 0.1% FS; 250 and 400 bar ranges are marked as test bench favorites.'
    }
  },
  {
    id: 'wika-s20',
    manufacturer: 'WIKA',
    models: ['S-20'],
    sensorType: 'Industrial pressure transmitter',
    measurand: 'pressure',
    ranges: [pressureRange(250, true), pressureRange(400, true), pressureRange(600), pressureRange(1000), pressureRange(1600)],
    preferredRangeIds: ['pressure-relative-0-250', 'pressure-relative-0-400'],
    defaultTolerancePercentFs: 0.25,
    defaultPointPercentages: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    accuracy: {
      standardSpanPercent: 0.25,
      nonlinearitySpanPercentBfsl: 0.125,
      longTermStabilityPercentSpanPerYear: 0.1
    },
    outputSignals: ['4-20 mA', '0-10 V', '1-5 V'],
    source: {
      title: 'WIKA PE 81.61 · S-20',
      url: 'https://www.wika.com/media/Data-sheets/Pressure/Pressure-sensors/ds_pe8161_en_co.pdf',
      status: 'manufacturer',
      note: 'Ranges up to 1,600 bar; best variant with 0.125% BFSL or 0.25% maximum measurement error.'
    }
  },
  {
    id: 'internal-temperature-register',
    manufacturer: 'Internal test procedure',
    models: ['Temperature register 10–150 °C'],
    sensorType: 'Temperature register',
    measurand: 'temperature',
    ranges: [temperatureRegisterRange],
    preferredRangeIds: [temperatureRegisterRange.id],
    defaultTolerancePercentFs: 0.1,
    defaultPointValues: Array.from({ length: 15 }, (_, index) => 10 + index * 10),
    accuracy: { standardSpanPercent: 0.1 },
    outputSignals: ['Pt100'],
    source: {
      title: 'Internal test procedure · Temperature register',
      url: '',
      status: 'internal',
      note: 'Preliminary internal profile: 10, 20, …, 150°C. Verify against the approved test bench procedure before release.'
    }
  },
  {
    id: 'internal-load-cell-100kn',
    manufacturer: 'Test bench configuration',
    models: ['Load cell 100 kN · 2,01 mV/V'],
    sensorType: 'Strain-gauge load cell',
    measurand: 'force',
    ranges: [engineeringRange('force-0-100000n', '0 … 100.000 N · Force', 'force', 'N', 0, 100000)],
    preferredRangeIds: ['force-0-100000n'],
    defaultTolerancePercentFs: 0.2,
    defaultPointPercentages: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    accuracy: { standardSpanPercent: 0.2 },
    outputSignals: ['mV/V'],
    source: { title: 'Internal measurement path configuration · Load cell', url: '', status: 'internal', note: 'Rated force and calibrated sensitivity must be taken from the current calibration certificate.' }
  },
  {
    id: 'internal-torque-sensor-200nm',
    manufacturer: 'Test bench configuration',
    models: ['Torque sensor 200 Nm · 10.01 V calibrated'],
    sensorType: 'Torque sensor',
    measurand: 'torque',
    ranges: [engineeringRange('torque-0-200nm', '0 … 200 Nm · Torque', 'torque', 'Nm', 0, 200)],
    preferredRangeIds: ['torque-0-200nm'],
    defaultTolerancePercentFs: 0.2,
    defaultPointPercentages: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    accuracy: { standardSpanPercent: 0.2 },
    outputSignals: ['0-10 V'],
    source: { title: 'Internal measurement path configuration · Torque sensor', url: '', status: 'internal', note: 'Rated torque, zero signal, and calibrated output must be taken from the current calibration certificate.' }
  },
  {
    id: 'internal-torque-sensor-angle-output',
    manufacturer: 'Test bench configuration',
    models: ['Torque sensor · angle output 0…10 V'],
    sensorType: 'Integrierter angle output',
    measurand: 'angle',
    ranges: [engineeringRange('torque-sensor-angle-0-360', '0 … 360° · angle output', 'angle', '°', 0, 360)],
    preferredRangeIds: ['torque-sensor-angle-0-360'],
    defaultTolerancePercentFs: 0.2,
    defaultPointPercentages: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    accuracy: { standardSpanPercent: 0.2 },
    outputSignals: ['0-10 V'],
    source: { title: 'Internal measurement path configuration · integrated angle output', url: '', status: 'internal', note: 'Belongs to the same physical torque sensor; verify its scaling and output channel separately.' }
  },
  {
    id: 'internal-torque-sensor-speed-output',
    manufacturer: 'Test bench configuration',
    models: ['Torque sensor · speed output'],
    sensorType: 'Integrierter speed output',
    measurand: 'speed',
    ranges: [engineeringRange('torque-sensor-speed-0-3000', '0 … 3.000 rpm · Speed', 'speed', 'rpm', 0, 3000)],
    preferredRangeIds: ['torque-sensor-speed-0-3000'],
    defaultTolerancePercentFs: 0.2,
    defaultPointPercentages: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    accuracy: { standardSpanPercent: 0.2 },
    outputSignals: ['Pulse frequency'],
    source: { title: 'Internal measurement path configuration · integrated speed output', url: '', status: 'internal', note: 'Belongs to the same physical torque sensor; the reference measurement uses a laser and reflective marker.' }
  },
  {
    id: 'internal-turbine-flow',
    manufacturer: 'Test bench configuration',
    models: ['Turbine flow sensor · 0.05 cm³/pulse'],
    sensorType: 'Turbine flow sensor',
    measurand: 'flow',
    ranges: [engineeringRange('flow-0-30lmin', '0 … 30 l/min · Flow', 'flow', 'l/min', 0, 30)],
    preferredRangeIds: ['flow-0-30lmin'],
    defaultTolerancePercentFs: 0.5,
    defaultPointPercentages: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    accuracy: { standardSpanPercent: 0.5 },
    outputSignals: ['Pulse frequency'],
    source: { title: 'Internal measurement path configuration · turbine sensor', url: '', status: 'internal', note: 'Pulse volume depends on the sensor and must come from the test bench documentation or calibration certificate.' }
  },
  {
    id: 'internal-voltage-channel',
    manufacturer: 'Test bench configuration',
    models: ['Voltage path ±10 V'],
    sensorType: 'Voltage channel',
    measurand: 'voltage',
    ranges: [engineeringRange('voltage-minus10-plus10', '−10 … +10 V · Voltage', 'voltage', 'V', -10, 10)],
    preferredRangeIds: ['voltage-minus10-plus10'],
    defaultTolerancePercentFs: 0.1,
    defaultPointPercentages: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    accuracy: { standardSpanPercent: 0.1 },
    outputSignals: ['0-10 V', '±10 V'],
    source: { title: 'Internal measurement path configuration · Voltage', url: '', status: 'internal' }
  },
  {
    id: 'internal-angle-sensor',
    manufacturer: 'Test bench configuration',
    models: ['Angle sensor 0…360°'],
    sensorType: 'Angle sensor',
    measurand: 'angle',
    ranges: [engineeringRange('angle-0-360', '0 … 360° · Angle', 'angle', '°', 0, 360)],
    preferredRangeIds: ['angle-0-360'],
    defaultTolerancePercentFs: 0.2,
    defaultPointPercentages: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    accuracy: { standardSpanPercent: 0.2 },
    outputSignals: ['0-10 V'],
    source: { title: 'Internal measurement path configuration · Angle', url: '', status: 'internal' }
  }
];

export const amplifiers: Amplifier[] = [
  {
    id: 'knick-p27000',
    manufacturer: 'Knick',
    models: ['P 27000 H1', 'P 27000 F1'],
    deviceType: 'Universal isolation amplifier',
    supportedMeasurands: ['pressure'],
    supportedSignals: ['4-20 mA', '0-20 mA', '0-5 V', '0-10 V', '1-5 V'],
    accuracy: { gainErrorPercent: 0.08, temperatureCoefficientPercentPerK: 0.005 },
    source: {
      title: 'Knick VariTrans P 27000',
      url: 'https://www.knick-international.com/en/products/industrial-interface-technology/signal-conditioners/varitrans-p-27000/',
      status: 'manufacturer'
    }
  },
  {
    id: 'direct-rtd-input',
    manufacturer: 'Direct connection',
    models: ['Pt100 directly connected to measurement card'],
    deviceType: 'No external amplifier',
    supportedMeasurands: ['temperature'],
    supportedSignals: ['Pt100'],
    bypass: true,
    accuracy: { gainErrorPercent: 0 },
    source: {
      title: 'Direct connection according to test bench wiring',
      url: '',
      status: 'internal'
    }
  },
  {
    id: 'internal-dms-amplifier',
    manufacturer: 'Test bench configuration',
    models: ['4-channel strain-gauge amplifier'],
    deviceType: 'Strain-gauge amplifier',
    supportedMeasurands: ['force'],
    supportedSignals: ['mV/V', '0-10 V'],
    accuracy: { gainErrorPercent: 0.05 },
    source: { title: 'Internal test bench configuration · strain-gauge amplifier', url: '', status: 'internal', note: 'Record the exact model and channel accuracy in the test bench.' }
  },
  {
    id: 'direct-frequency-input',
    manufacturer: 'Direct connection',
    models: ['Frequency directly connected to counter card'],
    deviceType: 'No external amplifier',
    supportedMeasurands: ['flow', 'speed'],
    supportedSignals: ['Pulse frequency'],
    bypass: true,
    accuracy: { gainErrorPercent: 0 },
    source: { title: 'Direct connection according to test bench wiring', url: '', status: 'internal' }
  },
  {
    id: 'direct-voltage-input',
    manufacturer: 'Direct connection',
    models: ['Voltage directly connected to measurement card'],
    deviceType: 'No external amplifier',
    supportedMeasurands: ['voltage', 'angle', 'torque'],
    supportedSignals: ['0-10 V', '±10 V'],
    bypass: true,
    accuracy: { gainErrorPercent: 0 },
    source: { title: 'Direct connection according to test bench wiring', url: '', status: 'internal' }
  }
];

export const references: ReferenceSensor[] = [
  {
    id: 'fluke-2700g-350',
    manufacturer: 'Fluke Calibration',
    models: ['2700G-G35M · 350 bar'],
    deviceType: 'Reference pressure gauge',
    measurand: 'pressure',
    ranges: [pressureRange(350)],
    accuracy: { accuracyPercentFs: 0.02 },
    source: {
      title: 'Fluke 2700G Series Reference Pressure Gauge',
      url: 'https://www.fluke.com/en-us/product/calibration-tools/pressure-calibration/pressure-monitors/2700g',
      status: 'manufacturer',
      note: 'Up to 700 bar, accuracy up to 0.02% FS.'
    }
  },
  {
    id: 'fluke-2700g-700',
    manufacturer: 'Fluke Calibration',
    models: ['2700G-G70M · 700 bar'],
    deviceType: 'Reference pressure gauge',
    measurand: 'pressure',
    ranges: [pressureRange(700)],
    accuracy: { accuracyPercentFs: 0.02 },
    source: {
      title: 'Fluke 2700G Series Reference Pressure Gauge',
      url: 'https://www.fluke.com/en-us/product/calibration-tools/pressure-calibration/pressure-monitors/2700g',
      status: 'manufacturer',
      note: 'Up to 700 bar, accuracy up to 0.02% FS.'
    }
  },
  ...[250, 400, 700].map<ReferenceSensor>(max => ({
    id: `wika-cpg1500-${max}`,
    manufacturer: 'WIKA',
    models: [`CPG1500 · ${max} bar`],
    deviceType: 'Precision digital pressure gauge',
    measurand: 'pressure' as const,
    ranges: [pressureRange(max)],
    accuracy: { accuracyPercentFs: 0.05 },
    source: {
      title: 'WIKA CT 10.51 · CPG1500',
      url: 'https://www.wika.com/en-us/cpg1500.WIKA',
      status: 'manufacturer',
      note: 'Optional accuracy of 0.05% of span.'
    }
  })),
  {
    id: 'fluke-1524',
    manufacturer: 'Fluke Calibration',
    models: ['1524 with PRT'],
    deviceType: 'Reference thermometer',
    measurand: 'temperature',
    ranges: [{ ...temperatureRegisterRange, id: 'fluke-1524-prt-10-150' }],
    accuracy: { absoluteAccuracy: 0.023 },
    source: {
      title: 'Fluke Calibration 1524 Reference Thermometer',
      url: 'https://www.fluke.com/de-de/produkt/kalibratoren/temperaturkalibratoren/fluke-calibration-1524',
      status: 'manufacturer',
      note: 'PRT indication up to ±0.023°C at 200°C; used conservatively for the internal 10–150°C profile.'
    }
  },
  {
    id: 'hbk-k3607',
    manufacturer: 'HBK',
    models: ['K3607'],
    deviceType: 'Electrical strain-gauge calibration unit',
    measurand: 'electrical',
    supportedTargetMeasurands: ['force'],
    ranges: [{ id: 'electrical-mvv', label: '−10 … +10 mV/V · Strain-gauge bridge signal', measurand: 'electrical', unit: 'mV/V', min: -10, max: 10, span: 20, kind: 'bridge' }],
    accuracy: { accuracyPercentFs: 0.025, nonLinearityPercentFs: 0.01 },
    source: {
      title: 'HBK K3607 Calibration Unit · B00333',
      url: 'https://www.hbkworld.com/en/products/transducers/calibration-equipment/k3607',
      status: 'manufacturer',
      note: 'Electrical reference; therefore not selectable as a pressure reference.'
    }
  },
  {
    id: 'internal-frequency-generator',
    manufacturer: 'Test bench configuration',
    models: ['Frequency generator 0…10 kHz'],
    deviceType: 'Frequency reference',
    measurand: 'electrical',
    supportedTargetMeasurands: ['flow'],
    ranges: [engineeringRange('frequency-0-10000', '0 … 10,000 Hz · Frequency', 'electrical', 'Hz', 0, 10000)],
    accuracy: { accuracyPercentFs: 0.01 },
    source: { title: 'Internal test bench configuration · Frequency generator', url: '', status: 'internal', note: 'Record the device model and certified frequency uncertainty.' }
  },
  {
    id: 'internal-voltage-calibrator',
    manufacturer: 'Test bench configuration',
    models: ['Voltage reference ±10 V'],
    deviceType: 'Voltage reference',
    measurand: 'electrical',
    supportedTargetMeasurands: ['voltage', 'angle', 'torque'],
    ranges: [engineeringRange('reference-voltage-minus10-plus10', '−10 … +10 V · Reference', 'electrical', 'V', -10, 10)],
    accuracy: { accuracyPercentFs: 0.01 },
    source: { title: 'Internal test bench configuration · Voltage reference', url: '', status: 'internal', note: 'Record the exact reference device and certificate uncertainty.' }
  },
  {
    id: 'internal-deadweight-force',
    manufacturer: 'Test bench configuration',
    models: ['Deadweight force / force reference 0…400 N'],
    deviceType: 'Mechanical force reference for lever test',
    measurand: 'force',
    supportedTargetMeasurands: ['torque'],
    ranges: [engineeringRange('reference-force-0-400', '0 … 400 N · Weight force', 'force', 'N', 0, 400)],
    accuracy: { accuracyPercentFs: 0.02 },
    source: { title: 'Internal test bench configuration · Weight set and lever', url: '', status: 'internal', note: 'Record certified forces or masses, local gravitational acceleration, lever length, and alignment.' }
  },
  {
    id: 'internal-mass-set',
    manufacturer: 'Test bench configuration',
    models: ['Calibrated mass set 0…40 kg'],
    deviceType: 'Mass reference for lever test',
    measurand: 'force',
    supportedTargetMeasurands: ['torque'],
    ranges: [engineeringRange('reference-mass-0-40', '0 … 40 kg · Mass', 'force', 'kg', 0, 40)],
    accuracy: { accuracyPercentFs: 0.02 },
    source: { title: 'Internal test bench configuration · Mass set and lever', url: '', status: 'internal', note: 'Certified mass values and local gravitational acceleration must be recorded for the force calculation.' }
  },
  {
    id: 'internal-laser-tachometer',
    manufacturer: 'Test bench configuration',
    models: ['Laser speed reference with reflective marker'],
    deviceType: 'Optical speed reference',
    measurand: 'speed',
    ranges: [engineeringRange('laser-speed-0-3000', '0 … 3,000 rpm · Laser reference', 'speed', 'rpm', 0, 3000)],
    accuracy: { accuracyPercentFs: 0.02 },
    source: { title: 'Internal test bench configuration · Laser tachometer', url: '', status: 'internal', note: 'Record the specific device, reflective marker, working distance, and calibration certificate.' }
  },
  {
    id: 'internal-angle-reference',
    manufacturer: 'Test bench configuration',
    models: ['Angle reference 0…360°'],
    deviceType: 'Mechanical angle reference',
    measurand: 'angle',
    ranges: [engineeringRange('reference-angle-0-360', '0 … 360° · Angle reference', 'angle', '°', 0, 360)],
    accuracy: { accuracyPercentFs: 0.02 },
    source: { title: 'Internal test bench configuration · Angle reference', url: '', status: 'internal', note: 'Record the specific reference, resolution, and calibration certificate.' }
  }
];

export const dataAcquisitionDevices: DataAcquisitionDevice[] = [
  {
    id: 'ni-9205',
    manufacturer: 'NI',
    models: ['NI-9205'],
    deviceType: 'PC measurement card · Voltage',
    supportedMeasurands: ['pressure', 'force', 'torque', 'voltage', 'angle'],
    supportedSignals: ['0-5 V', '0-10 V', '1-5 V'],
    accuracyPercentFs: 0.0623,
    resolutionBits: 16,
    source: {
      title: 'NI-9205 Datasheet',
      url: 'https://download.ni.com/support/manuals/374188b_02.pdf',
      status: 'manufacturer',
      note: 'Absolute accuracy at ±10 V full scale: 6.230 µV = 0.0623% FS.'
    }
  },
  {
    id: 'ni-9208',
    manufacturer: 'NI',
    models: ['NI-9208'],
    deviceType: 'PC measurement card · Current',
    supportedMeasurands: ['pressure'],
    supportedSignals: ['4-20 mA', '0-20 mA'],
    accuracyPercentFs: 0.804,
    resolutionBits: 24,
    source: {
      title: 'NI-9208 Datasheet / NI Accuracy Example',
      url: 'https://knowledge.ni.com/KnowledgeArticleDetails?id=kA00Z000001Dd9WSAS&l=en-US',
      status: 'manufacturer',
      note: 'Conservative example at 20 mA: 0.76% of reading plus 0.04% of the 22 mA range.'
    }
  },
  {
    id: 'ni-9217',
    manufacturer: 'NI',
    models: ['NI-9217'],
    deviceType: 'PC measurement card · Pt100',
    supportedMeasurands: ['temperature'],
    supportedSignals: ['Pt100'],
    absoluteAccuracy: 1,
    resolutionBits: 24,
    source: {
      title: 'NI-9217 Datasheet',
      url: 'https://download.ni.com/support/manuals/374187a_02.pdf',
      status: 'manufacturer',
      note: 'Conservative: less than 1°C error across the complete operating temperature range.'
    }
  },
  {
    id: 'internal-counter-card',
    manufacturer: 'Test bench configuration',
    models: ['32-bit PC counter card'],
    deviceType: 'PC measurement card · Frequency',
    supportedMeasurands: ['flow', 'speed'],
    supportedSignals: ['Pulse frequency'],
    accuracyPercentFs: 0.01,
    resolutionBits: 32,
    source: { title: 'Internal test bench configuration · Counter card', url: '', status: 'internal', note: 'Record the specific card model and time-base accuracy.' }
  }
];


