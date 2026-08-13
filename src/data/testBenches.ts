import { ReferenceConversion, TestBench } from '../types';

export const identityConversion = (unit: string): ReferenceConversion => ({
  mode: 'identity', referenceUnit: unit, targetUnit: unit, factor: 1, offset: 0,
  description: `Reference setting and technical target value are identical in ${unit}.`
});

export const builtInTestBenches: TestBench[] = [
  {
    id: 'pb-01-pressure',
    name: 'Test bench PB-01 · Pressure',
    revision: '3',
    description: 'Two pressure measurement paths using the preferred 250 and 400 bar ranges.',
    source: 'built-in',
    measurementPaths: [250, 400].map((max, index) => ({
      id: `pb01-pressure-${max}`,
      name: `Pressure path ${max} bar`,
      measurand: 'pressure' as const,
      sensorId: 'wika-p30-p31', sensorModel: 'P-30', rangeId: `pressure-relative-0-${max}`,
      amplifierId: 'knick-p27000', amplifierModel: 'P 27000 H1',
      referenceId: max === 250 ? 'wika-cpg1500-250' : 'wika-cpg1500-400', referenceModel: `CPG1500 · ${max} bar`,
      dataAcquisitionId: 'ni-9205', dataAcquisitionModel: 'NI-9205',
      sensorBmk: `-B${index + 11}`, connector: `X${index + 1}:1-2`, amplifierBmk: '-A10', amplifierChannel: `CH${index + 1}`, dataAcquisitionBmk: '-A11', dataAcquisitionChannel: `AI${index}`,
      conversion: identityConversion('bar'), tolerancePercent: 0.1
    }))
  },
  {
    id: 'pb-02-multisensor',
    name: 'Test bench PB-02 · Multi-quantity',
    revision: '1',
    description: 'Example with five measurement paths: force, flow, temperature, voltage, and angle.',
    source: 'built-in',
    measurementPaths: [
      {
        id: 'pb02-force', name: 'Force path 100 kN', measurand: 'force',
        sensorId: 'internal-load-cell-100kn', sensorModel: 'Load cell 100 kN · 2.01 mV/V', rangeId: 'force-0-100000n',
        amplifierId: 'internal-dms-amplifier', amplifierModel: '4-channel strain-gauge amplifier',
        referenceId: 'hbk-k3607', referenceModel: 'K3607', dataAcquisitionId: 'ni-9205', dataAcquisitionModel: 'NI-9205',
        sensorBmk: '-B21', connector: 'X5:1-6', amplifierBmk: '-A20', amplifierChannel: 'CH1', dataAcquisitionBmk: '-A21', dataAcquisitionChannel: 'AI0',
        conversion: { mode: 'load-cell', referenceUnit: 'mV/V', targetUnit: 'N', factor: 1, offset: 0, ratedForceN: 100000, sensitivityMvV: 2.01, zeroReferenceValue: 0, description: 'Force = (reference signal − zero signal) / calibrated sensitivity × rated force.' },
        tolerancePercent: 0.2
      },
      {
        id: 'pb02-flow', name: 'Turbine flow path', measurand: 'flow',
        sensorId: 'internal-turbine-flow', sensorModel: 'Turbine flow sensor · 0.05 cm³/pulse', rangeId: 'flow-0-30lmin',
        amplifierId: 'direct-frequency-input', amplifierModel: 'Frequency directly connected to counter card',
        referenceId: 'internal-frequency-generator', referenceModel: 'Frequency generator 0…10 kHz', dataAcquisitionId: 'internal-counter-card', dataAcquisitionModel: '32-bit PC counter card',
        sensorBmk: '-B22', connector: 'X6:1-3', amplifierBmk: '—', amplifierChannel: 'direct', dataAcquisitionBmk: '-A22', dataAcquisitionChannel: 'CTR0',
        conversion: { mode: 'pulse-flow', referenceUnit: 'Hz', targetUnit: 'l/min', factor: 1, offset: 0, pulseVolumeCm3: 0.05, description: 'Flow = frequency × pulse volume × 60 / 1,000.' },
        tolerancePercent: 0.5
      },
      {
        id: 'pb02-temperature', name: 'Temperature register', measurand: 'temperature',
        sensorId: 'internal-temperature-register', sensorModel: 'Temperature register 10–150 °C', rangeId: 'temperature-register-10-150',
        amplifierId: 'direct-rtd-input', amplifierModel: 'Pt100 directly connected to measurement card',
        referenceId: 'fluke-1524', referenceModel: '1524 with PRT', dataAcquisitionId: 'ni-9217', dataAcquisitionModel: 'NI-9217',
        sensorBmk: '-B23', connector: 'X7:1-4', amplifierBmk: '—', amplifierChannel: 'direct', dataAcquisitionBmk: '-A23', dataAcquisitionChannel: 'RTD0',
        conversion: identityConversion('°C'), tolerancePercent: 0.1
      },
      {
        id: 'pb02-voltage', name: 'Voltage path ±10 V', measurand: 'voltage',
        sensorId: 'internal-voltage-channel', sensorModel: 'Voltage path ±10 V', rangeId: 'voltage-minus10-plus10',
        amplifierId: 'direct-voltage-input', amplifierModel: 'Voltage directly connected to measurement card',
        referenceId: 'internal-voltage-calibrator', referenceModel: 'Voltage reference ±10 V', dataAcquisitionId: 'ni-9205', dataAcquisitionModel: 'NI-9205',
        sensorBmk: '-U24', connector: 'X8:1-2', amplifierBmk: '—', amplifierChannel: 'direct', dataAcquisitionBmk: '-A21', dataAcquisitionChannel: 'AI2',
        conversion: identityConversion('V'), tolerancePercent: 0.1
      },
      {
        id: 'pb02-angle', name: 'Angle path 0…360°', measurand: 'angle',
        sensorId: 'internal-angle-sensor', sensorModel: 'Angle sensor 0…360°', rangeId: 'angle-0-360',
        amplifierId: 'direct-voltage-input', amplifierModel: 'Voltage directly connected to measurement card',
        referenceId: 'internal-voltage-calibrator', referenceModel: 'Voltage reference ±10 V', dataAcquisitionId: 'ni-9205', dataAcquisitionModel: 'NI-9205',
        sensorBmk: '-B25', connector: 'X9:1-3', amplifierBmk: '—', amplifierChannel: 'direct', dataAcquisitionBmk: '-A21', dataAcquisitionChannel: 'AI3',
        conversion: { mode: 'linear', referenceUnit: 'V', targetUnit: '°', factor: 36, offset: 0, description: 'Angle = reference voltage × 36°/V.' },
        tolerancePercent: 0.2
      }
    ]
  },
  {
    id: 'pb-03-torque',
    name: 'Test bench PB-03 · Torque',
    revision: 'Draft 1',
    description: 'One physical torque sensor with three separate measurement paths: torque, integrated angle, and rotational speed.',
    source: 'built-in',
    measurementPaths: [
      {
        id: 'pb03-torque-200', name: 'Torque · 0…200 Nm', physicalSensorId: 'pb03-sensor-torque-01', physicalSensorName: 'Torque sensor -B31', measurand: 'torque',
        sensorId: 'internal-torque-sensor-200nm', sensorModel: 'Torque sensor 200 Nm · 10.01 V calibrated', rangeId: 'torque-0-200nm',
        amplifierId: 'direct-voltage-input', amplifierModel: 'Voltage directly connected to measurement card',
        referenceId: 'internal-deadweight-force', referenceModel: 'Deadweight force / force reference 0…400 N', dataAcquisitionId: 'ni-9205', dataAcquisitionModel: 'NI-9205',
        sensorBmk: '-B31', connector: 'X10:1-4', amplifierBmk: '—', amplifierChannel: 'direct', dataAcquisitionBmk: '-A31', dataAcquisitionChannel: 'AI4',
        conversion: {
          mode: 'torque-lever', referenceUnit: 'N', targetUnit: 'Nm', factor: 1, offset: 0,
          leverLengthM: 0.5, leverInputKind: 'force', gravityMs2: 9.80665, leverAngleDeg: 90, direction: 1, tareTorqueNm: 0,
          description: 'Mechanical full-chain test: torque = force × effective lever length × sin(angle), including direction and tare.'
        },
        referencePointValues: [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400],
        tolerancePercent: 0.2
      },
      {
        id: 'pb03-angle-360', name: 'Angle · 0…360°', physicalSensorId: 'pb03-sensor-torque-01', physicalSensorName: 'Torque sensor -B31', measurand: 'angle',
        sensorId: 'internal-torque-sensor-angle-output', sensorModel: 'Torque sensor · angle output 0…10 V', rangeId: 'torque-sensor-angle-0-360',
        amplifierId: 'direct-voltage-input', amplifierModel: 'Voltage directly connected to measurement card',
        referenceId: 'internal-angle-reference', referenceModel: 'Angle reference 0…360°', dataAcquisitionId: 'ni-9205', dataAcquisitionModel: 'NI-9205',
        sensorBmk: '-B31', connector: 'X10:5-6', amplifierBmk: '—', amplifierChannel: 'direct', dataAcquisitionBmk: '-A31', dataAcquisitionChannel: 'AI5',
        conversion: identityConversion('°'), tolerancePercent: 0.2
      },
      {
        id: 'pb03-speed-3000', name: 'Speed · 0…3,000 rpm', physicalSensorId: 'pb03-sensor-torque-01', physicalSensorName: 'Torque sensor -B31', measurand: 'speed',
        sensorId: 'internal-torque-sensor-speed-output', sensorModel: 'Torque sensor · speed output', rangeId: 'torque-sensor-speed-0-3000',
        amplifierId: 'direct-frequency-input', amplifierModel: 'Frequency directly connected to counter card',
        referenceId: 'internal-laser-tachometer', referenceModel: 'Laser speed reference with reflective marker', dataAcquisitionId: 'internal-counter-card', dataAcquisitionModel: '32-bit PC counter card',
        sensorBmk: '-B31', connector: 'X10:7-8', amplifierBmk: '—', amplifierChannel: 'direct', dataAcquisitionBmk: '-A32', dataAcquisitionChannel: 'CTR1',
        conversion: identityConversion('rpm'), tolerancePercent: 0.2
      }
    ]
  }
];

