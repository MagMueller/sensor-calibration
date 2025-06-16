import React from 'react';
import { CalibrationResult } from '../types';

interface DashboardProps {
  calibrationResults: CalibrationResult[];
  onStartCalibration: () => void;
}

const Dashboard = ({ calibrationResults, onStartCalibration }: DashboardProps) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusBadge = (passed: boolean) => {
    return passed ? (
      <span className="status-success">✓ Bestanden</span>
    ) : (
      <span className="status-danger">✗ Nicht bestanden</span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Kalibrierungs-Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Willkommen zur professionellen Messtechnik-Kalibrierung
        </p>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Neue Kalibrierung starten
          </h2>
          <p className="text-gray-600 mb-6">
            Starten Sie eine neue Kalibrierung mit Sensor, Verstärker und Referenzsensor
          </p>
          <button
            onClick={onStartCalibration}
            className="btn-primary text-lg px-8 py-3"
          >
            🚀 Kalibrierung starten
          </button>
        </div>
      </div>

      {/* Recent Calibrations */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Letzte Kalibrierungen
        </h2>
        
        {calibrationResults.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-6xl mb-4 block">📋</span>
            <p className="text-lg">Noch keine Kalibrierungen durchgeführt</p>
            <p className="text-sm">Starten Sie Ihre erste Kalibrierung oben</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sensor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verstärker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Referenz
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Messbereich
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gesamtunsicherheit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {calibrationResults.slice(-10).reverse().map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(result.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{result.setup.sensor.manufacturer}</div>
                        <div className="text-gray-500">{result.setup.selectedSensorModel}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{result.setup.amplifier.manufacturer}</div>
                        <div className="text-gray-500">{result.setup.selectedAmplifierModel}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{result.setup.referenceSensor.manufacturer}</div>
                        <div className="text-gray-500">{result.setup.selectedReferenceModel}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.setup.selectedPressureRange} bar
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ±{result.totalUncertainty.toFixed(4)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(result.passed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statistics */}
      {calibrationResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card text-center">
            <div className="text-3xl font-bold text-primary-600">
              {calibrationResults.length}
            </div>
            <div className="text-sm text-gray-600">Gesamte Kalibrierungen</div>
          </div>
          
          <div className="card text-center">
            <div className="text-3xl font-bold text-success-600">
              {calibrationResults.filter(r => r.passed).length}
            </div>
            <div className="text-sm text-gray-600">Erfolgreich</div>
          </div>
          
          <div className="card text-center">
            <div className="text-3xl font-bold text-danger-600">
              {calibrationResults.filter(r => !r.passed).length}
            </div>
            <div className="text-sm text-gray-600">Fehlgeschlagen</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 