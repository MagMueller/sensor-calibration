import { useEffect, useState } from 'react';
import { DataLoader } from '../data/dataLoader';
import { Amplifier, CalibrationSetup, ReferenceSensor, Sensor } from '../types';

interface CalibrationSetupProps {
  onStartCalibration: (setup: CalibrationSetup) => void;
  onCancel: () => void;
}

const CalibrationSetupComponent = ({ onStartCalibration, onCancel }: CalibrationSetupProps) => {
  const [sensors] = useState<Sensor[]>(DataLoader.getSensors());
  const [amplifiers] = useState<Amplifier[]>(DataLoader.getAmplifiers());
  const [referenceSensors] = useState<ReferenceSensor[]>(DataLoader.getReferenceSensors());

  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [selectedAmplifier, setSelectedAmplifier] = useState<Amplifier | null>(null);
  const [selectedReferenceSensor, setSelectedReferenceSensor] = useState<ReferenceSensor | null>(null);

  const [selectedSensorModel, setSelectedSensorModel] = useState<string>('');
  const [selectedAmplifierModel, setSelectedAmplifierModel] = useState<string>('');
  const [selectedReferenceModel, setSelectedReferenceModel] = useState<string>('');

  const [selectedPressureRange, setSelectedPressureRange] = useState<number | string>('');
  const [tolerancePercent, setTolerancePercent] = useState<number>(0.1);
  const [measurementPoints, setMeasurementPoints] = useState<number>(10);

  const [pressureRanges, setPressureRanges] = useState<Array<{label: string, value: number | string}>>([]);
  const [totalUncertainty, setTotalUncertainty] = useState<number>(0);

  // Update pressure ranges when sensor changes
  useEffect(() => {
    if (selectedSensor) {
      const ranges = DataLoader.getPressureRanges(selectedSensor);
      setPressureRanges(ranges);
      if (ranges.length > 0) {
        setSelectedPressureRange(ranges[0].value);
      }
    }
  }, [selectedSensor]);

  // Calculate total uncertainty when devices change
  useEffect(() => {
    if (selectedSensor && selectedAmplifier && selectedReferenceSensor) {
      const uncertainty = DataLoader.calculateTotalUncertainty(
        selectedSensor,
        selectedAmplifier,
        selectedReferenceSensor
      );
      setTotalUncertainty(uncertainty);
    }
  }, [selectedSensor, selectedAmplifier, selectedReferenceSensor]);

  const handleSensorChange = (manufacturerIndex: number) => {
    const sensor = sensors[manufacturerIndex];
    setSelectedSensor(sensor);
    setSelectedSensorModel(sensor.models[0] || '');
  };

  const handleAmplifierChange = (manufacturerIndex: number) => {
    const amplifier = amplifiers[manufacturerIndex];
    setSelectedAmplifier(amplifier);
    setSelectedAmplifierModel(amplifier.models[0] || '');
  };

  const handleReferenceSensorChange = (manufacturerIndex: number) => {
    const referenceSensor = referenceSensors[manufacturerIndex];
    setSelectedReferenceSensor(referenceSensor);
    setSelectedReferenceModel(referenceSensor.models[0] || '');
  };

  const canStartCalibration = () => {
    return (
      selectedSensor &&
      selectedAmplifier &&
      selectedReferenceSensor &&
      selectedSensorModel &&
      selectedAmplifierModel &&
      selectedReferenceModel &&
      selectedPressureRange &&
      tolerancePercent > 0 &&
      measurementPoints > 0
    );
  };

  const handleStartCalibration = () => {
    if (!canStartCalibration()) return;

    const setup: CalibrationSetup = {
      sensor: selectedSensor!,
      amplifier: selectedAmplifier!,
      referenceSensor: selectedReferenceSensor!,
      selectedSensorModel,
      selectedAmplifierModel,
      selectedReferenceModel,
      selectedPressureRange,
      tolerancePercent,
      measurementPoints
    };

    onStartCalibration(setup);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Kalibrierung einrichten
        </h1>
        <p className="text-lg text-gray-600">
          Wählen Sie Sensor, Verstärker und Referenzsensor für die Messtrecke
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Selection */}
        <div className="space-y-6">
          {/* Sensor Selection */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">📏</span>
              Sensor auswählen
            </h3>
            
            <div className="form-group">
              <label className="form-label">Hersteller</label>
              <select
                className="form-select"
                onChange={(e) => handleSensorChange(parseInt(e.target.value))}
                value={selectedSensor ? sensors.indexOf(selectedSensor) : ''}
              >
                <option value="">-- Sensor wählen --</option>
                {sensors.map((sensor, index) => (
                  <option key={index} value={index}>
                    {sensor.manufacturer} - {sensor.sensor_type}
                  </option>
                ))}
              </select>
            </div>

            {selectedSensor && (
              <div className="form-group">
                <label className="form-label">Modell</label>
                <select
                  className="form-select"
                  value={selectedSensorModel}
                  onChange={(e) => setSelectedSensorModel(e.target.value)}
                >
                  {selectedSensor.models.map((model, index) => (
                    <option key={index} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedSensor && (
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div><strong>Genauigkeit:</strong> ±{selectedSensor.accuracy.standard_span_percent}% vom Messbereich</div>
                <div><strong>Ausgangssignale:</strong> {selectedSensor.output_signals.join(', ')}</div>
              </div>
            )}
          </div>

          {/* Amplifier Selection */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">⚡</span>
              Verstärker auswählen
            </h3>
            
            <div className="form-group">
              <label className="form-label">Hersteller</label>
              <select
                className="form-select"
                onChange={(e) => handleAmplifierChange(parseInt(e.target.value))}
                value={selectedAmplifier ? amplifiers.indexOf(selectedAmplifier) : ''}
              >
                <option value="">-- Verstärker wählen --</option>
                {amplifiers.map((amplifier, index) => (
                  <option key={index} value={index}>
                    {amplifier.manufacturer} - {amplifier.device_type}
                  </option>
                ))}
              </select>
            </div>

            {selectedAmplifier && (
              <div className="form-group">
                <label className="form-label">Modell</label>
                <select
                  className="form-select"
                  value={selectedAmplifierModel}
                  onChange={(e) => setSelectedAmplifierModel(e.target.value)}
                >
                  {selectedAmplifier.models.map((model, index) => (
                    <option key={index} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedAmplifier && (
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div><strong>Verstärkungsgenauigkeit:</strong> ±{selectedAmplifier.accuracy.gain_error_percent}%</div>
                <div><strong>Ausgangsbereiche:</strong> {selectedAmplifier.output_ranges.current_mA?.join(', ') || 'N/A'} mA</div>
              </div>
            )}
          </div>

          {/* Reference Sensor Selection */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">🎯</span>
              Referenzsensor auswählen
            </h3>
            
            <div className="form-group">
              <label className="form-label">Hersteller</label>
              <select
                className="form-select"
                onChange={(e) => handleReferenceSensorChange(parseInt(e.target.value))}
                value={selectedReferenceSensor ? referenceSensors.indexOf(selectedReferenceSensor) : ''}
              >
                <option value="">-- Referenzsensor wählen --</option>
                {referenceSensors.map((referenceSensor, index) => (
                  <option key={index} value={index}>
                    {referenceSensor.manufacturer} - {referenceSensor.device_type}
                  </option>
                ))}
              </select>
            </div>

            {selectedReferenceSensor && (
              <div className="form-group">
                <label className="form-label">Modell</label>
                <select
                  className="form-select"
                  value={selectedReferenceModel}
                  onChange={(e) => setSelectedReferenceModel(e.target.value)}
                >
                  {selectedReferenceSensor.models.map((model, index) => (
                    <option key={index} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedReferenceSensor && (
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div><strong>Genauigkeitsklasse:</strong> {selectedReferenceSensor.accuracy.accuracy_class || 'N/A'}</div>
                <div><strong>Kalibriersignale:</strong> {selectedReferenceSensor.calibration_signals?.range_steps_mV_per_V?.join(', ') || 'N/A'} mV/V</div>
              </div>
            )}
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-6">
          {/* Pressure Range Selection */}
          {selectedSensor && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">📊</span>
                Messbereich auswählen
              </h3>
              
              <div className="form-group">
                <label className="form-label">Druckbereich</label>
                <select
                  className="form-select"
                  value={selectedPressureRange}
                  onChange={(e) => setSelectedPressureRange(
                    isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                  )}
                >
                  <option value="">-- Bereich wählen --</option>
                  {pressureRanges.map((range, index) => (
                    <option key={index} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Calibration Settings */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">⚙️</span>
              Kalibrierungseinstellungen
            </h3>
            
            <div className="form-group">
              <label className="form-label">Toleranz (%)</label>
              <input
                type="number"
                className="form-input"
                value={tolerancePercent}
                onChange={(e) => setTolerancePercent(Number(e.target.value))}
                step="0.01"
                min="0.01"
                max="10"
              />
              <p className="text-sm text-gray-500 mt-1">
                Zulässige Abweichung in Prozent vom Messbereich
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Anzahl Messpunkte</label>
              <input
                type="number"
                className="form-input"
                value={measurementPoints}
                onChange={(e) => setMeasurementPoints(Number(e.target.value))}
                min="5"
                max="20"
              />
              <p className="text-sm text-gray-500 mt-1">
                Empfohlen: 10 Messpunkte über den gesamten Messbereich
              </p>
            </div>
          </div>

          {/* Total Uncertainty Display */}
          {selectedSensor && selectedAmplifier && selectedReferenceSensor && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">📈</span>
                Gesamtmessungenauigkeit
              </h3>
              
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">
                    ±{totalUncertainty.toFixed(4)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Quadratische Summe aller Unsicherheiten (RSS)
                  </div>
                </div>
                
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Sensor:</span>
                    <span>±{selectedSensor.accuracy.standard_span_percent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verstärker:</span>
                    <span>±{selectedAmplifier.accuracy.gain_error_percent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Referenz:</span>
                    <span>±{selectedReferenceSensor.accuracy.accuracy_class || 0}%</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Gesamt (RSS):</span>
                    <span>±{totalUncertainty.toFixed(4)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={onCancel}
          className="btn-secondary px-8 py-3"
        >
          ← Abbrechen
        </button>
        <button
          onClick={handleStartCalibration}
          disabled={!canStartCalibration()}
          className={`px-8 py-3 ${
            canStartCalibration() ? 'btn-primary' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Kalibrierung starten →
        </button>
      </div>
    </div>
  );
};

export default CalibrationSetupComponent; 