import { useState } from 'react';
import { DataLoader } from '../data/dataLoader';
import { CalibrationResult, MeasurementPoint } from '../types';

interface CalibrationResultsProps {
  results: CalibrationResult[];
  onNewCalibration: () => void;
  onBackToOverview: () => void;
  onStartVerification: (source: CalibrationResult, pcGain: number, pcOffset: number) => void;
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
const signed = (value: number, decimals = 4) => `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}`;

const resultKey = (result: CalibrationResult) => `${result.setup.measurementPathId}-${result.createdAt.toISOString()}`;

const CalibrationResults = ({ results, onNewCalibration, onBackToOverview, onStartVerification }: CalibrationResultsProps) => {
  const [selectedResultKey, setSelectedResultKey] = useState(() => resultKey(results[results.length - 1]));
  const result = results.find(item => resultKey(item) === selectedResultKey) ?? results[results.length - 1];
  const technician = result.technician || result.setup.technician || 'Unknown';
  const span = result.setup.selectedRange.span;
  const unit = result.setup.selectedRange.unit;
  const correction = DataLoader.calculateGainAndOffset(result.measurements, span);
  const pcSettings = DataLoader.calculateRecommendedPcSettings(result.setup.pcGain, result.setup.pcOffset, correction);
  const correctionStats = DataLoader.calculateCorrectionStats(correction);
  const uncertainty = DataLoader.calculateDetailedUncertainty(result.setup);
  const tur = DataLoader.calculateTur(result.setup, uncertainty.expandedUncertainty);
  const passedPoints = result.measurements.filter(point => point.inToleranz).length;
  const pointPass = passedPoints === result.measurements.length;
  const guardbandPass = result.measurements.every(point => DataLoader.passesGuardband(point.abweichungPercent, uncertainty.expandedUncertainty, result.setup.tolerancePercent));
  const deviations = result.measurements.map(point => point.abweichungPercent);
  const maxDeviation = deviations.length ? Math.max(...deviations.map(Math.abs)) : 0;
  const mean = deviations.length ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length : 0;
  const standardDeviation = deviations.length ? Math.sqrt(deviations.reduce((sum, value) => sum + (value - mean) ** 2, 0) / deviations.length) : 0;
  const chartLimit = Math.max(result.setup.tolerancePercent * 1.35, maxDeviation * 1.1, 0.01);

  const exportCsv = () => {
    const quote = (value: string | number | boolean) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ['No.', `Reference setpoint [${result.setup.referenceConversion.referenceUnit}]`, `Target value [${unit}]`, `Reading [${unit}]`, `Deviation [${unit}]`, 'Deviation [% FS]', 'Tolerance utilization [%]', 'Within tolerance', 'Timestamp'],
      ...result.measurements.map(point => [
        point.id,
        point.referenceSetpoint.toFixed(6),
        point.sollWert.toFixed(6),
        point.istWert.toFixed(6),
        point.abweichung.toFixed(6),
        point.abweichungPercent.toFixed(6),
        point.toleranceUtilizationPercent.toFixed(3),
        point.inToleranz ? 'Yes' : 'No',
        point.timestamp.toISOString()
      ])
    ];
    const metadata = [
      ['Responsible technician', technician],
      ['Tested at', result.createdAt.toISOString()],
      ['Measurement range', result.setup.selectedRange.label],
      ['Test bench', result.setup.testBenchName],
      ['Measurement path', result.setup.measurementPathName],
      ['Sensor equipment ID', result.setup.sensorBmk],
      ['Connector', result.setup.connector],
      ['Amplifier equipment ID/channel', `${result.setup.amplifierBmk} / ${result.setup.amplifierChannel}`],
      ['DAQ equipment ID/channel', `${result.setup.dataAcquisitionBmk} / ${result.setup.dataAcquisitionChannel}`],
      ['Reference conversion', result.setup.referenceConversion.description],
      ['Protocol issue', result.setup.protocolIssue],
      ['Template state at start', result.setup.templateLocked ? 'Locked' : 'Editable'],
      ['Template amendment records', result.setup.templateAmendmentHistory?.length ?? 0],
      ['Amendment', result.setup.amendmentNote || '—'],
      ...(result.setup.templateAmendmentHistory ?? []).map((record, index) => [
        `Amendment ${index + 1}`,
        `${record.timestamp} · ${record.author} · ${record.action} · Issue ${record.issue} · ${record.note}`
      ]),
      ['Sensor serial number', result.setup.sensorSerial || '—'],
      ['Reference serial number', result.setup.referenceSerial || '—'],
      ['Tolerance [% FS]', result.setup.tolerancePercent],
      [`UUT requirement [${unit}]`, tur.uutToleranceAbsolute],
      ['Expanded uncertainty [% FS]', uncertainty.expandedUncertainty],
      [`Calibration uncertainty U [${unit}]`, tur.calibrationUncertaintyAbsolute],
      [`Display resolution [${unit}]`, result.setup.displayResolution],
      ['Current PC gain', pcSettings.currentGain],
      [`Current PC offset [${unit}]`, pcSettings.currentOffset],
      ['Recommended PC gain', pcSettings.recommendedGain],
      [`Recommended PC offset [${unit}]`, pcSettings.recommendedOffset],
      ['TUR', Number.isFinite(tur.ratio) ? tur.ratio : 'infinite'],
      ['Required TUR', `> ${tur.requiredRatio}`],
      ['Result', result.passed ? 'Passed' : 'Failed']
    ];
    const csv = '\uFEFF' + [...metadata, [], ...rows].map(row => row.map(value => quote(value)).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `calibration_${result.createdAt.toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    const rows = result.measurements.map(point => `<tr><td>${point.id}</td><td>${point.referenceSetpoint.toFixed(6)} ${result.setup.referenceConversion.referenceUnit}</td><td>${point.sollWert.toFixed(6)}</td><td>${point.istWert.toFixed(6)}</td><td>${signed(point.abweichungPercent, 4)}%</td><td>${point.toleranceUtilizationPercent.toFixed(1)}%</td><td>${point.inToleranz ? 'OK' : 'Out of tolerance'}</td></tr>`).join('');
    printWindow.document.write(`<html lang="en"><head><title>Calibration report</title><style>body{font:14px Arial;margin:32px;color:#0f172a}h1{margin-bottom:4px}small{color:#64748b}.summary{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:24px 0}.box{border:1px solid #cbd5e1;padding:12px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f1f5f9}.status{font-size:20px;font-weight:bold;color:${result.passed ? '#047857' : '#be123c'}}</style></head><body><h1>${result.setup.testBenchName} · ${result.setup.measurementPathName}</h1><small>Issue ${result.setup.protocolIssue} · ${formatDate(result.createdAt)} · ${result.setup.runMode === 'simulation' ? 'SIMULATION / NOT OFFICIAL' : 'CALIBRATION RUN'}</small><p><b>Responsible technician:</b> ${technician}<br><b>Tested at:</b> ${formatDate(result.createdAt)}<br><b>Template state:</b> ${result.setup.templateLocked ? 'Locked' : 'Editable'} at start</p><p class="status">${result.passed ? 'Passed' : 'Failed'}</p><div class="summary"><div class="box"><b>Sensor</b><br>${result.setup.sensor.manufacturer} ${result.setup.selectedSensorModel}<br>Equipment ID ${result.setup.sensorBmk} · SN ${result.setup.sensorSerial || '—'}<br>Connector ${result.setup.connector}</div><div class="box"><b>Amplifier</b><br>${result.setup.amplifier.manufacturer} ${result.setup.selectedAmplifierModel}<br>${result.setup.amplifierBmk} / ${result.setup.amplifierChannel}</div><div class="box"><b>Reference</b><br>${result.setup.referenceSensor.manufacturer} ${result.setup.selectedReferenceModel}<br>SN ${result.setup.referenceSerial || '—'}</div><div class="box"><b>PC measurement card</b><br>${result.setup.dataAcquisition.manufacturer} ${result.setup.selectedDataAcquisitionModel}<br>Equipment ID ${result.setup.dataAcquisitionBmk} · Channel ${result.setup.dataAcquisitionChannel}</div><div class="box"><b>Measurement range</b><br>${result.setup.selectedRange.label}</div><div class="box"><b>Uncertainty ratio</b><br>UUT ±${tur.uutToleranceAbsolute.toFixed(6)} ${unit}<br>Calibration ±${tur.calibrationUncertaintyAbsolute.toFixed(6)} ${unit}<br>TUR ${Number.isFinite(tur.ratio) ? tur.ratio.toFixed(4) : '∞'} : 1 (required &gt; ${tur.requiredRatio})</div><div class="box"><b>PC adjustment recommendation</b><br>Gain ${pcSettings.currentGain.toFixed(6)} → ${pcSettings.recommendedGain.toFixed(6)}<br>Offset ${pcSettings.currentOffset.toFixed(6)} → ${pcSettings.recommendedOffset.toFixed(6)} ${unit}<br>A complete remeasurement is required after applying these values.</div></div><p><b>Display resolution:</b> ${result.setup.displayResolution} ${unit}</p><p><b>Conversion:</b> ${result.setup.referenceConversion.description}</p><p><b>Amendment:</b> ${result.setup.amendmentNote || '—'}</p><table><thead><tr><th>#</th><th>Reference [${result.setup.referenceConversion.referenceUnit}]</th><th>Target [${unit}]</th><th>Reading [${unit}]</th><th>Deviation [% FS]</th><th>Utilization</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {results.length > 1 && <section className="card-flat"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Test bench completed</p><h1 className="section-title">Result by measurement path</h1></div><span className="text-sm text-slate-500">{results.filter(item => item.passed).length}/{results.length} passed</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.map((item, index) => { const active = resultKey(item) === resultKey(result); return <button type="button" key={resultKey(item)} onClick={() => setSelectedResultKey(resultKey(item))} aria-pressed={active} className={`rounded-xl border p-4 text-left transition ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Measurement path {index + 1}</span><strong className="mt-1 block text-slate-900">{item.setup.measurementPathName}</strong><span className={item.passed ? 'status-success mt-3' : 'status-danger mt-3'}>{item.passed ? 'Passed' : 'Failed'}</span></button>; })}</div></section>}

      <section className={`workspace-hero border-l-4 ${result.passed ? 'border-l-emerald-400' : 'border-l-rose-400'}`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="eyebrow">Step 3 · Evaluate · Issue {result.setup.protocolIssue}</p><h1 className="page-title">{result.setup.measurementPathName}</h1><p className="mt-2 text-sm font-semibold text-slate-300">Tested by {technician} · {formatDate(result.createdAt)}</p><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{result.passed ? 'All measurement points satisfy the guardband and the required TUR > 3.' : !pointPass ? `${result.measurements.length - passedPoints} measurement point(s) are outside tolerance.` : !tur.passes ? `TUR ${Number.isFinite(tur.ratio) ? tur.ratio.toFixed(4) : '∞'} : 1 does not meet the required value > ${tur.requiredRatio}.` : !guardbandPass ? 'At least one point violates the guardband |error| + U ≤ tolerance.' : 'The decision rule is not satisfied.'}</p></div>
          <div className="flex shrink-0 flex-col items-end gap-2"><span className={`rounded-lg px-4 py-2 text-sm font-black ${result.passed ? 'bg-emerald-400 text-emerald-950' : 'bg-rose-400 text-rose-950'}`}>{result.passed ? '✓ Passed' : '× Failed'}</span>{result.setup.runMode === 'simulation' && <span className="status-warning">Simulation / not official</span>}</div>
        </div>
      </section>

      <section className="card-flat"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">Traceability snapshot</p><h2 className="section-title">Who tested what, and under which issue</h2></div><span className={result.setup.templateLocked ? 'status-success' : 'status-warning'}>{result.setup.templateLocked ? 'Template was locked' : 'Template was editable'}</span></div><dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><TraceValue label="Responsible technician" value={technician} /><TraceValue label="Tested at" value={formatDate(result.createdAt)} /><TraceValue label="Protocol issue" value={result.setup.protocolIssue} /><TraceValue label="Amendment records" value={String(result.setup.templateAmendmentHistory?.length ?? 0)} /></dl>{result.setup.templateAmendmentHistory?.length > 0 && <div className="mt-5 border-t border-slate-200 pt-4"><h3 className="text-sm font-bold text-slate-900">Template history at start of test</h3><div className="mt-3 space-y-2">{result.setup.templateAmendmentHistory.slice(0, 3).map(record => <div key={record.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><strong className="text-slate-900">{record.author}</strong> · {new Date(record.timestamp).toLocaleString('en-GB')} · {record.action.replace(/-/g, ' ')}<span className="block text-xs">{record.note}</span></div>)}</div></div>}{result.setup.amendmentNote && <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><strong>Run note:</strong> {result.setup.amendmentNote}</p>}</section>

      <CalibrationPhasesResult result={result} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResultMetric label="Measurement points" value={`${passedPoints}/${result.measurements.length}`} note="within tolerance" tone={pointPass ? 'good' : 'bad'} />
        <ResultMetric label="Maximum deviation" value={`${maxDeviation.toFixed(4)}%`} note="of full scale" tone={maxDeviation <= result.setup.tolerancePercent ? 'good' : 'bad'} />
        <ResultMetric label="Test Uncertainty Ratio" value={`${Number.isFinite(tur.ratio) ? tur.ratio.toFixed(4) : '∞'} : 1`} note={`required > ${tur.requiredRatio}`} tone={tur.passes ? 'good' : 'bad'} />
        <ResultMetric label="Standard deviation" value={`${standardDeviation.toFixed(4)}%`} note="signed deviations" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="card-flat">
          <div className="mb-6"><p className="eyebrow">Deviation profile</p><h2 className="section-title">Every point against ±{result.setup.tolerancePercent}% FS</h2></div>
          <div className="space-y-4">{result.measurements.map(point => {
            const position = Math.max(1, Math.min(99, 50 + point.abweichungPercent / chartLimit * 50));
            const toleranceWidth = Math.min(100, result.setup.tolerancePercent / chartLimit * 100);
            const dot = point.toleranceStatus === 'danger' ? 'bg-rose-500' : point.toleranceStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
            return <div key={point.id} className="grid grid-cols-[36px_1fr_105px] items-center gap-3 text-sm"><span className="font-semibold text-slate-500">{point.id}</span><div className="relative h-3 rounded-full bg-slate-100"><div className="absolute inset-y-0 rounded-full bg-emerald-100" style={{ left: `${50 - toleranceWidth / 2}%`, width: `${toleranceWidth}%` }} /><div className="absolute inset-y-[-3px] w-px bg-slate-400" style={{ left: '50%' }} /><div className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${dot}`} style={{ left: `${position}%` }} /></div><span className="text-right font-mono text-xs font-bold">{point.toleranceUtilizationPercent.toFixed(1)}%</span></div>;
          })}</div>
          <div className="mt-4 flex justify-between text-[11px] text-slate-400"><span>−{chartLimit.toFixed(2)}%</span><span>0% FS</span><span>+{chartLimit.toFixed(2)}%</span></div>
        </div>

        <div className="card-flat">
          <div className="mb-5"><p className="eyebrow">Measurement chain</p><h2 className="section-title">Uncertainty budget</h2></div>
          <div className="space-y-3">{uncertainty.components.map(component => <div key={component.id} className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-600">{component.label}<small className="block text-[10px] text-slate-400">{component.source}</small></span><strong className="whitespace-nowrap font-mono">{(component.expandedPercentFs * span / 100).toFixed(6)} {unit}<small className="block text-right text-[10px] font-normal text-slate-400">{component.expandedPercentFs.toFixed(4)}% FS</small></strong></div>)}</div>
          <div className="mt-5 border-t border-slate-200 pt-4"><div className="flex justify-between gap-3 text-sm font-bold"><span>Calibration uncertainty U (k={uncertainty.coverageFactor})</span><span className="whitespace-nowrap">±{tur.calibrationUncertaintyAbsolute.toFixed(6)} {unit}</span></div><div className={`mt-4 rounded-xl p-4 ${tur.passes ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}><div className="flex justify-between gap-3 text-sm"><span>Sensor/UUT requirement</span><strong>±{tur.uutToleranceAbsolute.toFixed(6)} {unit}</strong></div><div className="mt-2 flex justify-between gap-3 text-sm"><span>Calibration uncertainty</span><strong>±{tur.calibrationUncertaintyAbsolute.toFixed(6)} {unit}</strong></div><div className="mt-3 flex justify-between gap-3 border-t border-current/20 pt-3 font-bold"><span>TUR, required &gt; {tur.requiredRatio}</span><span>{Number.isFinite(tur.ratio) ? tur.ratio.toFixed(4) : '∞'} : 1</span></div></div><p className="mt-3 text-xs leading-5 text-slate-500">The UUT requirement is the numerator used for comparison; it is not added to the calibration uncertainty a second time.</p><div className="mt-3 space-y-1 text-xs leading-5 text-slate-500">{uncertainty.excludedNotes.map(note => <p key={note}>{note}</p>)}</div></div>
        </div>
      </section>

      <section className="card-flat">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">PC adjustment recommendation</p><h2 className="section-title">Best gain and offset from this measurement series</h2><p className="mt-2 text-sm text-slate-500">One-time correction of the current display: target value = reading × {correction.gain.toFixed(6)} {correction.offset >= 0 ? '+' : '−'} {Math.abs(correction.offset).toFixed(6)} {unit}</p></div><div className="text-sm text-slate-500">R² {correction.rSquared.toFixed(5)} · RMSE {correction.rmse.toFixed(6)} {unit}</div></div>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]"><SettingCard label="Currently in the PC" gain={pcSettings.currentGain} offset={pcSettings.currentOffset} unit={unit} /><div className="hidden items-center text-2xl text-slate-300 lg:flex">→</div><SettingCard label="Recommended" gain={pcSettings.recommendedGain} offset={pcSettings.recommendedOffset} unit={unit} recommended /></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3"><ResultMetric label="Average before" value={`${correctionStats.originalAvgDeviation.toFixed(4)}%`} note="absolute deviation" /><ResultMetric label="Average corrected" value={`${correctionStats.correctedAvgDeviation.toFixed(4)}%`} note="absolute deviation" tone="good" /><ResultMetric label="Improvement" value={`${correctionStats.improvementPercent.toFixed(1)}%`} note="0% for perfect data" tone={correctionStats.improvementPercent >= 0 ? 'good' : 'bad'} /></div>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm leading-6 text-amber-950"><strong>Prediction, not measurement evidence:</strong> Non-linearity, hysteresis, and adjustment rounding may remain. Enter the values manually in the test bench software, then remeasure every reference point.</p><button type="button" className="btn-primary mt-4" onClick={() => onStartVerification(result, pcSettings.recommendedGain, pcSettings.recommendedOffset)}>Values applied in PC — start verification →</button></div>
      </section>

      <section className="card-flat">
        <div className="mb-5"><p className="eyebrow">Measurement record</p><h2 className="section-title">Raw and corrected values</h2></div>
        <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>#</th><th>Reference [{result.setup.referenceConversion.referenceUnit}]</th><th>Target [{unit}]</th><th>Reading [{unit}]</th><th>Deviation [% FS]</th><th>Utilization</th><th>Corrected [{unit}]</th><th>Corrected deviation</th><th>Prediction</th></tr></thead><tbody>{correction.correctedMeasurements.map((point, index) => { const original = result.measurements[index]; const statusClass = original.toleranceStatus === 'danger' ? 'status-danger' : original.toleranceStatus === 'warning' ? 'status-warning' : 'status-success'; const correctedPass = tur.passes && DataLoader.passesGuardband(point.correctedDeviationPercent, uncertainty.expandedUncertainty, result.setup.tolerancePercent); return <tr key={index}><td>{index + 1}</td><td>{original.referenceSetpoint.toFixed(6)}</td><td>{point.sollWert.toFixed(6)}</td><td>{point.istWert.toFixed(6)}</td><td>{signed(point.originalDeviationPercent, 4)}%</td><td><span className={statusClass}>{original.toleranceUtilizationPercent.toFixed(1)}%</span></td><td>{point.correctedValue.toFixed(6)}</td><td>{signed(point.correctedDeviationPercent, 4)}%</td><td><span className={correctedPass ? 'status-success' : 'status-danger'}>{correctedPass ? 'predicted OK' : 'predicted failure'}</span></td></tr>;})}</tbody></table></div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-bold">Report and raw data</h2><p className="text-sm text-slate-400">The semicolon-separated CSV is Excel-compatible and safely escapes fields.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={exportPdf} className="btn-light">Print PDF</button><button onClick={exportCsv} className="btn-light">Export CSV</button><button onClick={onBackToOverview} className="btn-dark-outline">Test benches</button><button onClick={onNewCalibration} className="btn-primary">Calibrate this test bench again</button></div>
      </section>
    </div>
  );
};

const CalibrationPhasesResult = ({ result }: { result: CalibrationResult }) => {
  if (!result.measurements.length) return null;
  const zeroPoint = result.measurements.reduce((closest, point) => Math.abs(point.sollWert) < Math.abs(closest.sollWert) ? point : closest);
  const endPoint = result.measurements.reduce((highest, point) => point.sollWert > highest.sollWert ? point : highest);
  const correction = DataLoader.calculateGainAndOffset(result.measurements, result.setup.selectedRange.span);
  const measuredDeviations = result.measurements.map(point => point.abweichungPercent);
  const correctedDeviations = correction.correctedMeasurements.map(point => point.correctedDeviationPercent);
  const tolerance = result.setup.tolerancePercent;
  const yLimit = Math.max(tolerance * 1.35, ...measuredDeviations.map(Math.abs), ...correctedDeviations.map(Math.abs), 0.01);
  const width = 700;
  const height = 280;
  const leftPad = 72;
  const rightPad = 18;
  const topPad = 22;
  const bottomPad = 42;
  const x = (index: number) => leftPad + index / Math.max(1, result.measurements.length - 1) * (width - leftPad - rightPad);
  const y = (value: number) => topPad + (yLimit - value) / (2 * yLimit) * (height - topPad - bottomPad);
  const line = (values: number[]) => values.map((value, index) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(' ');
  const yTicks = Array.from(new Set([yLimit, tolerance, 0, -tolerance, -yLimit].map(value => Number(value.toFixed(8))))).sort((a, b) => b - a);
  const unit = result.setup.selectedRange.unit;

  return <section className="card-flat"><div className="mb-6"><p className="eyebrow">Adjustment by measurement path</p><h2 className="section-title">Zero point → full scale → characteristic curve</h2><p className="mt-2 text-sm text-slate-500">All three views use only the readings just captured for this measurement path.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[0.65fr_0.65fr_1.4fr]">
    <PhasePointCard number="1" title="Zero point" note={zeroPoint.sollWert === 0 ? 'Test point with no applied load' : 'Test point closest to zero'} point={zeroPoint} unit={unit} referenceUnit={result.setup.referenceConversion.referenceUnit} /><PhasePointCard number="2" title="Full scale" note="Highest technical target value" point={endPoint} unit={unit} referenceUnit={result.setup.referenceConversion.referenceUnit} />
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 lg:col-span-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><span className="text-xs font-bold uppercase tracking-wider text-blue-600">3 · Characteristic curve</span><h3 className="font-bold text-slate-900">Deviation across all {result.measurements.length} points</h3><p className="mt-1 text-xs text-slate-500">The ideal profile is a horizontal line at 0% FS.</p></div><div className="flex flex-wrap gap-3 text-xs text-slate-600"><span><i className="mr-1 inline-block h-0.5 w-4 bg-blue-600 align-middle" />Measured</span><span><i className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed border-emerald-600 align-middle" />Corrected prediction</span></div></div><svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" role="img" aria-label={`Deviation curve for measurement path ${result.setup.measurementPathName} as a percentage of full scale`}><title>Deviation before and mathematically after gain/offset correction</title><rect x={leftPad} y={topPad} width={width - leftPad - rightPad} height={height - topPad - bottomPad} rx="10" fill="#ffffff" stroke="#cbd5e1" /><rect x={leftPad} y={y(tolerance)} width={width - leftPad - rightPad} height={Math.max(0, y(-tolerance) - y(tolerance))} fill="#dcfce7" opacity="0.75" />{yTicks.map(tick => <g key={tick}><line x1={leftPad} x2={width - rightPad} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#475569' : '#dbe3ec'} strokeWidth={tick === 0 ? 2 : 1} strokeDasharray={Math.abs(tick) === tolerance ? '5 4' : undefined} /><text x={leftPad - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#64748b">{signed(tick, 3)}%</text></g>)}<text x="15" y={height / 2} textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569" transform={`rotate(-90 15 ${height / 2})`}>Deviation [% FS]</text><polyline points={line(measuredDeviations)} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /><polyline points={line(correctedDeviations)} fill="none" stroke="#059669" strokeWidth="3" strokeDasharray="7 5" strokeLinejoin="round" strokeLinecap="round" />{result.measurements.map((point, index) => <circle key={point.id} cx={x(index)} cy={y(point.abweichungPercent)} r="6" fill={point.toleranceStatus === 'danger' ? '#e11d48' : point.toleranceStatus === 'warning' ? '#d97706' : '#2563eb'} stroke="#ffffff" strokeWidth="3"><title>{`${point.id}: target ${point.sollWert.toFixed(6)} ${unit}, deviation ${signed(point.abweichungPercent, 5)}% FS`}</title></circle>)}{correctedDeviations.map((deviation, index) => <circle key={`corrected-${index}`} cx={x(index)} cy={y(deviation)} r="4" fill="#059669" stroke="#ffffff" strokeWidth="2"><title>{`${index + 1}: mathematically corrected ${signed(deviation, 5)}% FS`}</title></circle>)}<text x={(leftPad + width - rightPad) / 2} y={height - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569">Measurement point / target value [{unit}]</text></svg><div className="mt-1 flex justify-between pl-14 text-xs text-slate-500"><span>1 · {formatCompact(result.measurements[0].sollWert)} {unit}</span><span>{result.measurements.length} · {formatCompact(result.measurements[result.measurements.length - 1].sollWert)} {unit}</span></div></div>
  </div></section>;
};

const PhasePointCard = ({ number, title, note, point, unit, referenceUnit }: { number: string; title: string; note: string; point: MeasurementPoint; unit: string; referenceUnit: string }) => {
  const statusClass = point.toleranceStatus === 'danger' ? 'status-danger' : point.toleranceStatus === 'warning' ? 'status-warning' : 'status-success';
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-wider text-blue-600">{number} · {title}</span><p className="mt-1 text-xs text-slate-500">{note}</p></div><span className={statusClass}>{point.toleranceUtilizationPercent.toFixed(1)}%</span></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><PhaseValue label="Set reference" value={point.referenceSetpoint} unit={referenceUnit} tone="reference" /><PhaseValue label="PC target" value={point.sollWert} unit={unit} /><PhaseValue label="PC reading" value={point.istWert} unit={unit} /></div><p className="mt-4 text-sm text-slate-600">Deviation <strong className="font-mono text-slate-900">{signed(point.abweichungPercent, 4)}% FS</strong></p></div>;
};

const PhaseValue = ({ label, value, unit, tone = 'normal' }: { label: string; value: number; unit: string; tone?: 'normal' | 'reference' }) => <div><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span><strong className={`mt-1 block font-mono text-sm ${tone === 'reference' ? 'text-blue-700' : 'text-slate-900'}`}>{formatCompact(value)}</strong><span className="text-[10px] text-slate-500">{unit}</span></div>;
const formatCompact = (value: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 }).format(value);

const SettingCard = ({ label, gain, offset, unit, recommended = false }: { label: string; gain: number; offset: number; unit: string; recommended?: boolean }) => <div className={`rounded-xl border p-4 ${recommended ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><span className={`text-xs font-bold uppercase tracking-wider ${recommended ? 'text-emerald-700' : 'text-slate-500'}`}>{label}</span><div className="mt-3 grid grid-cols-2 gap-3"><div><small className="block text-xs text-slate-500">Gain</small><strong className="font-mono text-lg">{gain.toFixed(8)}</strong></div><div><small className="block text-xs text-slate-500">Offset</small><strong className="font-mono text-lg">{offset.toFixed(8)}</strong><small className="ml-1 text-slate-500">{unit}</small></div></div></div>;

const ResultMetric = ({ label, value, note, tone = 'neutral' }: { label: string; value: string; note: string; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) => {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-950';
  return <div className="metric-card text-left"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><strong className={`mt-2 ${color}`}>{value}</strong><span>{note}</span></div>;
};

const TraceValue = ({ label, value }: { label: string; value: string }) => <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>;

export default CalibrationResults;
