import { DataLoader } from '../data/dataLoader';
import { CalibrationResult } from '../types';

interface CalibrationResultsProps {
  result: CalibrationResult;
  onNewCalibration: () => void;
  onBackToDashboard: () => void;
}

const CalibrationResults = ({ result, onNewCalibration, onBackToDashboard }: CalibrationResultsProps) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const formatNumber = (num: number, decimals: number = 4) => {
    return num.toFixed(decimals);
  };

  const getStatusBadge = (passed: boolean) => {
    return passed ? (
      <div className="inline-flex items-center px-4 py-2 rounded-full bg-success-100 text-success-800 font-medium">
        <span className="text-lg mr-2">✅</span>
        Bestanden
      </div>
    ) : (
      <div className="inline-flex items-center px-4 py-2 rounded-full bg-danger-100 text-danger-800 font-medium">
        <span className="text-lg mr-2">❌</span>
        Nicht bestanden
      </div>
    );
  };

  const getStatusColor = (inTolerance: boolean) => {
    return inTolerance ? 'text-success-600' : 'text-danger-600';
  };

  // Removed unused function

  const exportToCsv = () => {
    const headers = ['Nr.', 'Sollwert [bar]', 'Istwert [bar]', 'Abweichung [bar]', 'Abweichung [%]', 'In Toleranz', 'Zeitstempel'];
    const csvContent = [
      headers.join(','),
      ...result.measurements.map(m => [
        m.id,
        formatNumber(m.sollWert, 4),
        formatNumber(m.istWert, 4),
        formatNumber(m.abweichung, 4),
        formatNumber(m.abweichungPercent, 2),
        m.inToleranz ? 'Ja' : 'Nein',
        formatDate(m.timestamp)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `kalibrierung_${formatDate(result.createdAt).replace(/[^\w]/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kalibrierungsbericht</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table th, .info-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .info-table th { background-color: #f2f2f2; }
          .measurements-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .measurements-table th, .measurements-table td { border: 1px solid #ddd; padding: 8px; text-align: center; }
          .measurements-table th { background-color: #f2f2f2; }
          .passed { color: green; }
          .failed { color: red; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Kalibrierungsbericht</h1>
          <p>Erstellt am: ${formatDate(result.createdAt)}</p>
        </div>
        
        <h2>Konfiguration</h2>
        <table class="info-table">
          <tr><th>Sensor</th><td>${result.setup.sensor.manufacturer} ${result.setup.selectedSensorModel}</td></tr>
          <tr><th>Verstärker</th><td>${result.setup.amplifier.manufacturer} ${result.setup.selectedAmplifierModel}</td></tr>
          <tr><th>Referenzsensor</th><td>${result.setup.referenceSensor.manufacturer} ${result.setup.selectedReferenceModel}</td></tr>
          <tr><th>Messbereich</th><td>${result.setup.selectedPressureRange} bar</td></tr>
          <tr><th>Toleranz</th><td>±${result.setup.tolerancePercent}%</td></tr>
          <tr><th>Gesamtunsicherheit</th><td>±${formatNumber(result.totalUncertainty, 4)}%</td></tr>
          <tr><th>Ergebnis</th><td class="${result.passed ? 'passed' : 'failed'}">${result.passed ? 'Bestanden' : 'Nicht bestanden'}</td></tr>
        </table>

        <h2>Messergebnisse</h2>
        <table class="measurements-table">
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Sollwert [bar]</th>
              <th>Istwert [bar]</th>
              <th>Abweichung [bar]</th>
              <th>Abweichung [%]</th>
              <th>In Toleranz</th>
            </tr>
          </thead>
          <tbody>
            ${result.measurements.map(m => `
              <tr>
                <td>${m.id}</td>
                <td>${formatNumber(m.sollWert, 4)}</td>
                <td>${formatNumber(m.istWert, 4)}</td>
                <td>${formatNumber(m.abweichung, 4)}</td>
                <td class="${m.inToleranz ? 'passed' : 'failed'}">${formatNumber(m.abweichungPercent, 2)}%</td>
                <td class="${m.inToleranz ? 'passed' : 'failed'}">${m.inToleranz ? 'Ja' : 'Nein'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // Calculate statistics
  const passedMeasurements = result.measurements.filter(m => m.inToleranz).length;
  const failedMeasurements = result.measurements.length - passedMeasurements;
  const maxDeviation = Math.max(...result.measurements.map(m => Math.abs(m.abweichungPercent)));
  const avgDeviation = result.measurements.reduce((sum, m) => sum + Math.abs(m.abweichungPercent), 0) / result.measurements.length;
  const stdDeviation = Math.sqrt(
    result.measurements.reduce((sum, m) => sum + Math.pow(Math.abs(m.abweichungPercent) - avgDeviation, 2), 0) / result.measurements.length
  );

  // Calculate Gain and Offset correction
  const gainOffsetData = DataLoader.calculateGainAndOffset(
    result.measurements.map(m => ({ sollWert: m.sollWert, istWert: m.istWert }))
  );
  const correctionStats = DataLoader.calculateCorrectionStats(gainOffsetData);

  // Create histogram data
  const createHistogram = () => {
    const buckets = 5;
    const minDev = Math.min(...result.measurements.map(m => m.abweichungPercent));
    const maxDev = Math.max(...result.measurements.map(m => m.abweichungPercent));
    const range = maxDev - minDev;
    const bucketSize = range / buckets;
    
    const histogram = Array(buckets).fill(0);
    result.measurements.forEach(m => {
      const bucketIndex = Math.min(Math.floor((m.abweichungPercent - minDev) / bucketSize), buckets - 1);
      histogram[bucketIndex]++;
    });
    
    return histogram.map((count, index) => ({
      range: `${formatNumber(minDev + index * bucketSize, 2)}% - ${formatNumber(minDev + (index + 1) * bucketSize, 2)}%`,
      count,
      percentage: (count / result.measurements.length) * 100
    }));
  };

  const histogramData = createHistogram();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Kalibrierungsergebnisse
        </h1>
        <p className="text-lg text-gray-600 mb-4">
          Erstellt am: {formatDate(result.createdAt)}
        </p>
        <div className="flex justify-center">
          {getStatusBadge(result.passed)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Summary and Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Setup Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">⚙️</span>
              Konfiguration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="space-y-2">
                  <div><strong>Sensor:</strong></div>
                  <div className="pl-4">
                    <div>{result.setup.sensor.manufacturer}</div>
                    <div className="text-gray-600">{result.setup.selectedSensorModel}</div>
                    <div className="text-gray-600">±{result.setup.sensor.accuracy.standard_span_percent}% Genauigkeit</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="space-y-2">
                  <div><strong>Verstärker:</strong></div>
                  <div className="pl-4">
                    <div>{result.setup.amplifier.manufacturer}</div>
                    <div className="text-gray-600">{result.setup.selectedAmplifierModel}</div>
                    <div className="text-gray-600">±{result.setup.amplifier.accuracy.gain_error_percent}% Verstärkungsgenauigkeit</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="space-y-2">
                  <div><strong>Referenzsensor:</strong></div>
                  <div className="pl-4">
                    <div>{result.setup.referenceSensor.manufacturer}</div>
                    <div className="text-gray-600">{result.setup.selectedReferenceModel}</div>
                    <div className="text-gray-600">Klasse {result.setup.referenceSensor.accuracy.accuracy_class || 'N/A'}</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="space-y-2">
                  <div><strong>Messbereich:</strong></div>
                  <div className="pl-4">
                    <div>{result.setup.selectedPressureRange} bar</div>
                    <div className="text-gray-600">±{result.setup.tolerancePercent}% Toleranz</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gain and Offset Analysis */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">🎯</span>
              Gain & Offset Korrekturfaktoren
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatNumber(gainOffsetData.gain, 5)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Gain (Verstärkung)</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Multiplikationsfaktor zur Steigungskorrektur
                  </div>
                </div>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatNumber(gainOffsetData.offset, 5)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Offset (Nullpunkt)</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Additionsfaktor zur Nullpunktkorrektur
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-primary-600">
                  {formatNumber(gainOffsetData.correlation * 100, 1)}%
                </div>
                <div className="text-gray-600">Korrelation (R²)</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-success-600">
                  {formatNumber(correctionStats.improvementPercent, 1)}%
                </div>
                <div className="text-gray-600">Verbesserung</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {formatNumber(gainOffsetData.rmse, 4)}
                </div>
                <div className="text-gray-600">RMSE</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Korrekturformel:</h4>
              <div className="font-mono text-sm bg-white border rounded p-3">
                Korrigierter_Wert = (Messwert × {formatNumber(gainOffsetData.gain, 5)}) + {formatNumber(gainOffsetData.offset, 5)}
              </div>
            </div>
          </div>

          {/* Original vs Corrected Comparison Table */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">📊</span>
              Vergleich: Original vs. Korrigiert
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nr.</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sollwert</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Istwert</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Korrigiert</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Orig. Abw. [%]</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Korr. Abw. [%]</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Verbesserung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {gainOffsetData.correctedMeasurements.map((measurement, index) => {
                    const improvement = Math.abs(measurement.originalDeviationPercent) - Math.abs(measurement.correctedDeviationPercent);
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{index + 1}</td>
                        <td className="px-3 py-2">{formatNumber(measurement.sollWert, 3)}</td>
                        <td className="px-3 py-2">{formatNumber(measurement.istWert, 4)}</td>
                        <td className="px-3 py-2 font-medium text-blue-600">{formatNumber(measurement.correctedValue, 4)}</td>
                        <td className="px-3 py-2 text-danger-600">
                          {formatNumber(measurement.originalDeviationPercent, 2)}%
                        </td>
                        <td className="px-3 py-2 text-success-600 font-medium">
                          {formatNumber(measurement.correctedDeviationPercent, 2)}%
                        </td>
                        <td className={`px-3 py-2 font-medium ${improvement > 0 ? 'text-success-600' : 'text-gray-500'}`}>
                          {improvement > 0 ? '↗️ ' : ''}
                          {formatNumber(Math.abs(improvement), 2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparison Statistics */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">📈</span>
              Verbesserungs-Statistiken
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Original Messungen</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Max. Abweichung:</span>
                    <span className="font-medium text-danger-600">{formatNumber(correctionStats.originalMaxDeviation, 3)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ø Abweichung:</span>
                    <span className="font-medium text-danger-600">{formatNumber(correctionStats.originalAvgDeviation, 3)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Standardabweichung:</span>
                    <span className="font-medium text-danger-600">{formatNumber(correctionStats.originalStdDeviation, 3)}%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Korrigierte Messungen</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Max. Abweichung:</span>
                    <span className="font-medium text-success-600">{formatNumber(correctionStats.correctedMaxDeviation, 3)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ø Abweichung:</span>
                    <span className="font-medium text-success-600">{formatNumber(correctionStats.correctedAvgDeviation, 3)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Standardabweichung:</span>
                    <span className="font-medium text-success-600">{formatNumber(correctionStats.correctedStdDeviation, 3)}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-success-50 border border-success-200 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-success-600">
                  {formatNumber(correctionStats.improvementPercent, 1)}%
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Gesamtverbesserung der durchschnittlichen Abweichung
                </div>
              </div>
            </div>
          </div>

          {/* Visualizations continue... */}
          <div className="space-y-6">
            {/* Original vs Corrected Chart */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">📊</span>
                Vergleich: Original vs. Korrigierte Abweichungen
              </h3>
              <div className="space-y-4">
                {gainOffsetData.correctedMeasurements.map((measurement, index) => {
                  const maxScale = Math.max(
                    Math.abs(measurement.originalDeviationPercent), 
                    Math.abs(measurement.correctedDeviationPercent),
                    result.setup.tolerancePercent
                  ) * 1.2;
                  
                  const originalBarWidth = (Math.abs(measurement.originalDeviationPercent) / maxScale) * 100;
                  const correctedBarWidth = (Math.abs(measurement.correctedDeviationPercent) / maxScale) * 100;
                  const toleranceWidth = (result.setup.tolerancePercent / maxScale) * 100;
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Punkt {index + 1}</span>
                        <div className="space-x-4">
                          <span className="text-danger-600">
                            Original: {formatNumber(measurement.originalDeviationPercent, 2)}%
                          </span>
                          <span className="text-success-600">
                            Korrigiert: {formatNumber(measurement.correctedDeviationPercent, 2)}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Original deviation bar */}
                      <div className="relative h-4 bg-gray-100 rounded mb-1">
                        <div 
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 h-full bg-success-200 rounded opacity-30"
                          style={{ width: `${toleranceWidth * 2}%` }}
                        ></div>
                        <div 
                          className="absolute top-0 left-1/2 h-full bg-danger-400 rounded opacity-70"
                          style={{ 
                            width: `${originalBarWidth}%`,
                            transform: measurement.originalDeviationPercent >= 0 
                              ? 'translateX(0)' 
                              : `translateX(-${originalBarWidth}%)`
                          }}
                        ></div>
                      </div>
                      
                      {/* Corrected deviation bar */}
                      <div className="relative h-4 bg-gray-100 rounded">
                        <div 
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 h-full bg-success-200 rounded opacity-30"
                          style={{ width: `${toleranceWidth * 2}%` }}
                        ></div>
                        <div 
                          className="absolute top-0 left-1/2 h-full bg-success-500 rounded"
                          style={{ 
                            width: `${correctedBarWidth}%`,
                            transform: measurement.correctedDeviationPercent >= 0 
                              ? 'translateX(0)' 
                              : `translateX(-${correctedBarWidth}%)`
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="text-xs text-gray-500 mt-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-success-200 rounded opacity-30"></div>
                      <span>Toleranzbereich (±{result.setup.tolerancePercent}%)</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-danger-400 rounded opacity-70"></div>
                      <span>Original</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-success-500 rounded"></div>
                      <span>Korrigiert</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Original Deviation Chart */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">📈</span>
                Original Abweichungsdiagramm
              </h3>
              <div className="space-y-4">
                {result.measurements.map((measurement, index) => {
                  const maxScale = Math.max(result.setup.tolerancePercent, maxDeviation) * 1.2;
                  const barWidth = (Math.abs(measurement.abweichungPercent) / maxScale) * 100;
                  const toleranceWidth = (result.setup.tolerancePercent / maxScale) * 100;
                  
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Punkt {measurement.id}</span>
                        <span className={getStatusColor(measurement.inToleranz)}>
                          {formatNumber(measurement.abweichungPercent, 2)}%
                        </span>
                      </div>
                      <div className="relative h-6 bg-gray-100 rounded">
                        {/* Tolerance band */}
                        <div 
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 h-full bg-success-200 rounded"
                          style={{ width: `${toleranceWidth * 2}%` }}
                        ></div>
                        
                        {/* Deviation bar */}
                        <div 
                          className={`absolute top-1 left-1/2 h-4 rounded ${
                            measurement.inToleranz ? 'bg-success-500' : 'bg-danger-500'
                          }`}
                          style={{ 
                            width: `${barWidth}%`,
                            transform: measurement.abweichungPercent >= 0 
                              ? 'translateX(0)' 
                              : `translateX(-${barWidth}%)`
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="text-xs text-gray-500 mt-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-success-200 rounded"></div>
                      <span>Toleranzbereich (±{result.setup.tolerancePercent}%)</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-success-500 rounded"></div>
                      <span>In Toleranz</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-danger-500 rounded"></div>
                      <span>Außerhalb Toleranz</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Histogram */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">📊</span>
                Häufigkeitsverteilung der Abweichungen
              </h3>
              <div className="space-y-3">
                {histogramData.map((bucket, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{bucket.range}</span>
                      <span>{bucket.count} Messungen ({formatNumber(bucket.percentage, 1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-primary-500 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${bucket.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trend Analysis */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">📈</span>
                Trendanalyse
              </h3>
              <div className="space-y-4">
                <div className="h-40 bg-gray-50 rounded-lg p-4 relative overflow-hidden">
                  <div className="absolute inset-0 p-4">
                    {/* Tolerance lines */}
                    <div 
                      className="absolute left-4 right-4 border-t-2 border-success-300 opacity-60"
                      style={{ top: `${30}%` }}
                    ></div>
                    <div 
                      className="absolute left-4 right-4 border-t-2 border-success-300 opacity-60"
                      style={{ top: `${70}%` }}
                    ></div>
                    
                    {/* Zero line */}
                    <div className="absolute left-4 right-4 top-1/2 border-t border-gray-400"></div>
                    
                    {/* Data points */}
                    <svg className="w-full h-full">
                      <polyline
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        points={result.measurements.map((m, i) => {
                          const x = (i / (result.measurements.length - 1)) * 100;
                          const y = 50 - (m.abweichungPercent / (maxDeviation * 1.2)) * 40;
                          return `${x}%,${y}%`;
                        }).join(' ')}
                      />
                      {result.measurements.map((m, i) => (
                        <circle
                          key={i}
                          cx={`${(i / (result.measurements.length - 1)) * 100}%`}
                          cy={`${50 - (m.abweichungPercent / (maxDeviation * 1.2)) * 40}%`}
                          r="3"
                          fill={m.inToleranz ? "#22c55e" : "#ef4444"}
                          stroke="white"
                          strokeWidth="1"
                        />
                      ))}
                    </svg>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Messpunkt 1</span>
                    <span>Messpunkt {result.measurements.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Uncertainty Breakdown */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">🎯</span>
                Unsicherheits-Aufschlüsselung
              </h3>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Sensor-Unsicherheit</span>
                    <span className="text-sm font-medium">±{result.setup.sensor.accuracy.standard_span_percent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-500 h-3 rounded-full"
                      style={{ 
                        width: `${(result.setup.sensor.accuracy.standard_span_percent / result.totalUncertainty) * 100}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Verstärker-Unsicherheit</span>
                    <span className="text-sm font-medium">±{result.setup.amplifier.accuracy.gain_error_percent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-orange-500 h-3 rounded-full"
                      style={{ 
                        width: `${(result.setup.amplifier.accuracy.gain_error_percent / result.totalUncertainty) * 100}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Referenz-Unsicherheit</span>
                    <span className="text-sm font-medium">±{result.setup.referenceSensor.accuracy.accuracy_class || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-purple-500 h-3 rounded-full"
                      style={{ 
                        width: `${((result.setup.referenceSensor.accuracy.accuracy_class || 0) / result.totalUncertainty) * 100}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-sm">Gesamt-Unsicherheit (RSS)</span>
                    <span className="text-sm">±{formatNumber(result.totalUncertainty, 4)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics and Actions */}
        <div className="space-y-6">
          {/* Enhanced Statistics */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">📈</span>
              Erweiterte Statistiken
            </h3>
            <div className="space-y-4">
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary-600">
                  ±{formatNumber(result.totalUncertainty, 4)}%
                </div>
                <div className="text-sm text-gray-600">Gesamtunsicherheit</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-success-600">{passedMeasurements}</div>
                  <div className="text-sm text-gray-600">Bestanden</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-danger-600">{failedMeasurements}</div>
                  <div className="text-sm text-gray-600">Fehlgeschlagen</div>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Max. Abweichung:</span>
                  <span className="font-medium">{formatNumber(maxDeviation, 2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Ø Abweichung:</span>
                  <span className="font-medium">{formatNumber(avgDeviation, 2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Standardabweichung:</span>
                  <span className="font-medium">{formatNumber(stdDeviation, 2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Messpunkte:</span>
                  <span className="font-medium">{result.measurements.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Erfolgsrate:</span>
                  <span className="font-medium">{formatNumber((passedMeasurements / result.measurements.length) * 100, 1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">💾</span>
              Export
            </h3>
            <div className="space-y-3">
              <button
                onClick={exportToPdf}
                className="w-full btn-primary py-2"
              >
                📄 PDF-Bericht
              </button>
              <button
                onClick={exportToCsv}
                className="w-full btn-secondary py-2"
              >
                📊 CSV-Daten
              </button>
            </div>
          </div>

          {/* Navigation Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">🔄</span>
              Weiter
            </h3>
            <div className="space-y-3">
              <button
                onClick={onNewCalibration}
                className="w-full btn-primary py-2"
              >
                🚀 Neue Kalibrierung
              </button>
              <button
                onClick={onBackToDashboard}
                className="w-full btn-secondary py-2"
              >
                🏠 Zum Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalibrationResults; 