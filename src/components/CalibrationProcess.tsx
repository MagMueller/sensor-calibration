import { useEffect, useState } from 'react';
import { DataLoader } from '../data/dataLoader';
import { CalibrationResult, CalibrationSetup, MeasurementPoint } from '../types';

interface CalibrationProcessProps {
  setup: CalibrationSetup;
  measurements: MeasurementPoint[];
  currentMeasurement: number;
  onAddMeasurement: (measurement: MeasurementPoint) => void;
  onComplete: (result: CalibrationResult) => void;
  onCancel: () => void;
}

const CalibrationProcess = ({
  setup,
  measurements,
  currentMeasurement,
  onAddMeasurement,
  onComplete,
  onCancel
}: CalibrationProcessProps) => {
  const [sollWert, setSollWert] = useState(0);
  const [istWert, setIstWert] = useState('');

  useEffect(() => {
    // Generate measurement points based on selected range
    const points = DataLoader.generateMeasurementPoints(
      setup.selectedPressureRange,
      setup.measurementPoints
    );
    
    if (points.length > 0 && currentMeasurement < points.length) {
      setSollWert(points[currentMeasurement]);
    }
  }, [setup, currentMeasurement]);

  const calculateDeviation = (soll: number, ist: number) => {
    const absoluteDeviation = ist - soll;
    const percentageDeviation = soll !== 0 ? (absoluteDeviation / soll) * 100 : 0;
    return { absoluteDeviation, percentageDeviation };
  };

  const isWithinTolerance = (soll: number, ist: number) => {
    const { percentageDeviation } = calculateDeviation(soll, ist);
    return Math.abs(percentageDeviation) <= setup.tolerancePercent;
  };

  const handleAddMeasurement = () => {
    const istValue = parseFloat(istWert);
    if (isNaN(istValue)) return;

    const { absoluteDeviation, percentageDeviation } = calculateDeviation(sollWert, istValue);
    const inTolerance = isWithinTolerance(sollWert, istValue);

    const measurement: MeasurementPoint = {
      id: currentMeasurement + 1,
      sollWert,
      istWert: istValue,
      abweichung: absoluteDeviation,
      abweichungPercent: percentageDeviation,
      inToleranz: inTolerance,
      timestamp: new Date()
    };

    onAddMeasurement(measurement);
    setIstWert('');

    // Check if calibration is complete
    if (currentMeasurement + 1 >= setup.measurementPoints) {
      const allMeasurements = [...measurements, measurement];
      const totalUncertainty = DataLoader.calculateTotalUncertainty(
        setup.sensor,
        setup.amplifier,
        setup.referenceSensor
      );
      const passed = allMeasurements.every(m => m.inToleranz);

      const result: CalibrationResult = {
        setup,
        measurements: allMeasurements,
        totalUncertainty,
        passed,
        createdAt: new Date()
      };

      onComplete(result);
    }
  };

  const getProgressPercentage = () => {
    return ((currentMeasurement) / setup.measurementPoints) * 100;
  };

  const getStatusIcon = (inTolerance: boolean) => {
    return inTolerance ? '✅' : '❌';
  };

  const getStatusColor = (inTolerance: boolean) => {
    return inTolerance ? 'text-success-600' : 'text-danger-600';
  };

  const formatNumber = (num: number, decimals: number = 4) => {
    return num.toFixed(decimals);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Kalibrierung durchführen
        </h1>
        <p className="text-lg text-gray-600">
          Messpunkt {currentMeasurement + 1} von {setup.measurementPoints}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Fortschritt</span>
          <span className="text-sm font-medium text-gray-700">
            {Math.round(getProgressPercentage())}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-primary-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${getProgressPercentage()}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Measurement */}
        <div className="space-y-6">
          {/* Setup Summary */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">⚙️</span>
              Konfiguration
            </h3>
            <div className="space-y-2 text-sm">
              <div><strong>Sensor:</strong> {setup.sensor.manufacturer} {setup.selectedSensorModel}</div>
              <div><strong>Verstärker:</strong> {setup.amplifier.manufacturer} {setup.selectedAmplifierModel}</div>
              <div><strong>Referenz:</strong> {setup.referenceSensor.manufacturer} {setup.selectedReferenceModel}</div>
              <div><strong>Messbereich:</strong> {setup.selectedPressureRange} bar</div>
              <div><strong>Toleranz:</strong> ±{setup.tolerancePercent}%</div>
            </div>
          </div>

          {/* Current Measurement Input */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">📊</span>
              Messpunkt {currentMeasurement + 1}
            </h3>
            
            <div className="space-y-4">
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Sollwert</div>
                  <div className="text-3xl font-bold text-primary-600">
                    {formatNumber(sollWert, 2)} bar
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Istwert eingeben</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    className="form-input flex-1"
                    value={istWert}
                    onChange={(e) => setIstWert(e.target.value)}
                    step="0.0001"
                    placeholder="Gemessenen Wert eingeben"
                    autoFocus
                  />
                  <span className="flex items-center text-gray-500">bar</span>
                </div>
              </div>

              <button
                onClick={handleAddMeasurement}
                disabled={!istWert || isNaN(parseFloat(istWert))}
                className={`w-full py-3 ${
                  istWert && !isNaN(parseFloat(istWert))
                    ? 'btn-primary'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Messung hinzufügen
              </button>

              {istWert && !isNaN(parseFloat(istWert)) && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Vorschau</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Sollwert:</span>
                      <span>{formatNumber(sollWert, 4)} bar</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Istwert:</span>
                      <span>{formatNumber(parseFloat(istWert), 4)} bar</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Abweichung:</span>
                      <span>{formatNumber(parseFloat(istWert) - sollWert, 4)} bar</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Abweichung %:</span>
                      <span className={getStatusColor(isWithinTolerance(sollWert, parseFloat(istWert)))}>
                        {formatNumber(calculateDeviation(sollWert, parseFloat(istWert)).percentageDeviation, 2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center font-medium">
                      <span>Status:</span>
                      <span className={getStatusColor(isWithinTolerance(sollWert, parseFloat(istWert)))}>
                        {getStatusIcon(isWithinTolerance(sollWert, parseFloat(istWert)))}
                        {isWithinTolerance(sollWert, parseFloat(istWert)) ? ' In Toleranz' : ' Außerhalb Toleranz'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Measurements Table */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="text-2xl mr-2">📋</span>
            Messergebnisse
          </h3>
          
          {measurements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-2 block">📊</span>
              <p>Noch keine Messungen durchgeführt</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Soll [bar]</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ist [bar]</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Abw. [%]</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {measurements.map((measurement, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{measurement.id}</td>
                      <td className="px-3 py-2">{formatNumber(measurement.sollWert, 2)}</td>
                      <td className="px-3 py-2">{formatNumber(measurement.istWert, 4)}</td>
                      <td className={`px-3 py-2 font-medium ${getStatusColor(measurement.inToleranz)}`}>
                        {formatNumber(measurement.abweichungPercent, 2)}%
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={getStatusColor(measurement.inToleranz)}>
                          {getStatusIcon(measurement.inToleranz)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {measurements.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-success-600">
                    {measurements.filter(m => m.inToleranz).length}
                  </div>
                  <div className="text-gray-600">In Toleranz</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-danger-600">
                    {measurements.filter(m => !m.inToleranz).length}
                  </div>
                  <div className="text-gray-600">Außerhalb</div>
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
      </div>
    </div>
  );
};

export default CalibrationProcess; 