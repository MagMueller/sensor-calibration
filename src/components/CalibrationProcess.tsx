import { useMemo, useState } from 'react';
import { DataLoader } from '../data/dataLoader';
import { CalibrationResult, CalibrationSetup, MeasurementPoint, ToleranceStatus } from '../types';

interface CalibrationProcessProps {
  setup: CalibrationSetup;
  remainingPaths?: number;
  onComplete: (result: CalibrationResult) => void;
  onCancel: () => void;
}

type DraftRow = { raw: string; source: 'manual' | 'simulation' | 'empty' };

const CalibrationProcess = ({ setup, remainingPaths = 0, onComplete, onCancel }: CalibrationProcessProps) => {
  const [rows, setRows] = useState<DraftRow[]>(() => setup.measurementPointValues.map(() => ({ raw: '', source: 'empty' })));
  const uncertainty = useMemo(() => DataLoader.calculateDetailedUncertainty(setup), [setup]);
  const tur = useMemo(() => DataLoader.calculateTur(setup, uncertainty.expandedUncertainty), [setup, uncertainty.expandedUncertainty]);
  const unit = setup.selectedRange.unit;
  const referenceUnit = setup.referenceConversion.referenceUnit;
  const referenceSetpoints = setup.referencePointValues;

  const evaluated = rows.map((row, index) => {
    const value = DataLoader.parseLocalizedNumber(row.raw);
    if (value === undefined) return undefined;
    return DataLoader.evaluateMeasurement(setup.measurementPointValues[index], value, setup.selectedRange, setup.tolerancePercent);
  });

  const updateRow = (index: number, raw: string, source: DraftRow['source'] = 'manual') => {
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { raw, source: raw.trim() ? source : 'empty' } : row));
  };
  const simulateRow = (index: number) => updateRow(index, formatEditable(DataLoader.simulateRandomValue(setup.measurementPointValues[index], setup.selectedRange, index, setup.tolerancePercent)), 'simulation');
  const simulateAll = () => setRows(setup.measurementPointValues.map((setpoint, index) => ({ raw: formatEditable(DataLoader.simulateRandomValue(setpoint, setup.selectedRange, index, setup.tolerancePercent)), source: 'simulation' })));
  const clearAll = () => setRows(setup.measurementPointValues.map(() => ({ raw: '', source: 'empty' })));

  const completed = evaluated.filter(Boolean).length;
  const containsSimulatedReadings = rows.some(row => row.source === 'simulation');
  const effectiveRunMode: CalibrationSetup['runMode'] = setup.runMode === 'simulation' || containsSimulatedReadings ? 'simulation' : 'calibration';
  const warningCount = evaluated.filter(item => item?.toleranceStatus === 'warning').length;
  const dangerCount = evaluated.filter(item => item?.toleranceStatus === 'danger').length;
  const allValid = completed === rows.length;
  const maxUtilization = evaluated.reduce((max, item) => Math.max(max, item?.toleranceUtilizationPercent ?? 0), 0);
  const measurements = evaluated.flatMap((evaluation, index): MeasurementPoint[] => {
    const value = DataLoader.parseLocalizedNumber(rows[index].raw);
    if (!evaluation || value === undefined) return [];
    return [{
      id: index + 1,
      sollWert: setup.measurementPointValues[index],
      referenceSetpoint: referenceSetpoints[index],
      istWert: value,
      abweichung: evaluation.absoluteDeviation,
      abweichungPercent: evaluation.percentageDeviation,
      toleranceLimit: evaluation.toleranceLimit,
      toleranceUtilizationPercent: evaluation.toleranceUtilizationPercent,
      toleranceStatus: evaluation.toleranceStatus,
      inToleranz: evaluation.inTolerance,
      timestamp: new Date()
    }];
  });
  const passed = allValid && tur.passes && measurements.every(point => DataLoader.passesGuardband(point.abweichungPercent, uncertainty.expandedUncertainty, setup.tolerancePercent));

  const finish = () => {
    if (!allValid) {
      document.getElementById(`measurement-${evaluated.findIndex(item => !item)}`)?.focus();
      return;
    }
    const recordedSetup = effectiveRunMode === setup.runMode ? setup : { ...setup, runMode: effectiveRunMode };
    onComplete({ setup: recordedSetup, measurements, totalUncertainty: uncertainty.expandedUncertainty, passed, createdAt: new Date(), technician: setup.technician });
  };

  return <div className="space-y-6">
    <header className="workspace-hero"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow">Step 2 · Measure · Issue {setup.protocolIssue}</p><h1 className="page-title">{setup.measurementPathName}</h1><p className="page-subtitle">{setup.testBenchName} · {setup.sensorBmk} · Connector {setup.connector}</p>{remainingPaths > 0 && <p className="mt-3 text-xs font-bold text-blue-300">{remainingPaths} additional measurement path(s) will follow automatically.</p>}</div><div className="flex flex-wrap items-center gap-2 lg:justify-end"><span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"><strong className="block text-white">{setup.technician}</strong>Technician</span><span className={effectiveRunMode === 'simulation' ? 'status-warning' : 'status-success'}>{effectiveRunMode === 'simulation' ? 'Simulation / not official' : 'Calibration run'}</span></div></div></header>

    <section className="instruction-panel"><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="eyebrow">Reference instruction</p><h2 className="text-base font-extrabold text-slate-950">Set {referenceUnit} at the reference → verify {unit} on the PC</h2><p className="mt-1 text-sm leading-5 text-slate-600">{setup.referenceConversion.description}</p></div><div className="rounded-lg border border-blue-200 bg-white/80 px-4 py-3 font-mono text-xs text-blue-950"><span className="block font-sans text-[9px] font-black uppercase tracking-wider text-blue-500">PC scaling</span>Gain {setup.pcGain.toFixed(8)} · Offset {setup.pcOffset.toFixed(8)} {unit}</div></div>{conversionExample(setup)}</section>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <LiveMetric label="Captured" value={`${completed}/${rows.length}`} note="measurement points" />
      <LiveMetric label="Max. utilization" value={`${maxUtilization.toFixed(1)}%`} note="of tolerance" status={DataLoader.getToleranceStatus(maxUtilization)} />
      <LiveMetric label="Adjustment required" value={String(warningCount)} note="70–100 %" status="warning" />
      <LiveMetric label="Out of tolerance" value={String(dangerCount)} note="> 100 %" status={dangerCount ? 'danger' : 'safe'} />
    </section>

    <section className="card-flat">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow">Complete test plan</p><h2 className="section-title">Capture all {rows.length} target values directly</h2><p className="mt-2 text-sm text-slate-500">Decimal points and commas are accepted. Every change updates the deviation and status immediately.</p>{containsSimulatedReadings && <p className="mt-2 text-sm font-semibold text-amber-700">Generated readings are present. This run will be saved as a non-official simulation.</p>}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={simulateAll} className="btn-primary">Generate new random values</button><button type="button" onClick={clearAll} className="btn-tertiary">Clear entries</button></div></div>

      <div className="hidden grid-cols-[40px_120px_120px_minmax(160px,1fr)_100px_120px_120px] gap-3 border-b border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 md:grid"><span>#</span><span>Reference input</span><span>PC target</span><span>PC reading</span><span>Action</span><span>Deviation</span><span>Utilization</span></div>
      <div className="divide-y divide-slate-100">{rows.map((row, index) => {
        const result = evaluated[index];
        return <div key={index} className={`measurement-row grid gap-3 px-3 py-4 md:grid-cols-[40px_120px_120px_minmax(160px,1fr)_100px_120px_120px] md:items-center ${statusBackground(result?.toleranceStatus)}`}>
          <div className="flex items-center justify-between md:block"><span className="text-xs font-bold uppercase text-slate-400 md:hidden">Measurement point</span><strong className="text-slate-500">{index + 1}</strong></div>
          <div><span className="text-xs font-bold uppercase text-blue-500 md:hidden">Set at reference</span><div className="font-mono font-bold text-blue-700">{formatNumber(referenceSetpoints[index])} {referenceUnit}</div></div>
          <div><span className="text-xs font-bold uppercase text-slate-400 md:hidden">PC target</span><div className="font-mono font-bold">{formatNumber(setup.measurementPointValues[index])} {unit}</div></div>
          <div><label className="sr-only" htmlFor={`measurement-${index}`}>Reading for measurement point {index + 1}, target {formatNumber(setup.measurementPointValues[index])} {unit}</label><div className="relative"><input id={`measurement-${index}`} type="text" inputMode="decimal" className="form-input pr-16 font-mono font-bold" value={row.raw} onChange={event => updateRow(index, event.target.value)} aria-invalid={row.raw.trim() !== '' && !result} placeholder={formatNumber(setup.measurementPointValues[index])} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span></div>{row.source === 'simulation' && <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-blue-600">Simulation</span>}{row.raw.trim() !== '' && !result && <span className="form-error">Invalid number</span>}</div>
          <button type="button" onClick={() => simulateRow(index)} className="btn-tertiary px-3 py-2 text-xs">Regenerate</button>
          <div><span className="text-xs font-bold uppercase text-slate-400 md:hidden">Deviation</span><div className="font-mono text-sm font-bold">{result ? `${signed(result.percentageDeviation, 4)}% FS` : '—'}</div></div>
          <div>{result ? <UtilizationBadge status={result.toleranceStatus} utilization={result.toleranceUtilizationPercent} /> : <span className="status-neutral">Pending</span>}</div>
        </div>;
      })}</div>
    </section>

    <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="card-flat"><p className="eyebrow">Live deviation profile</p><h2 className="section-title">Utilization of the permitted tolerance</h2><div className="mt-6 space-y-3">{evaluated.map((item, index) => <div key={index} className="grid grid-cols-[34px_1fr_70px] items-center gap-3"><span className="text-xs font-bold text-slate-400">{index + 1}</span><div className="relative h-3 overflow-hidden rounded-full bg-slate-100"><div className="absolute inset-y-0 left-0 w-[70%] bg-emerald-100" /><div className="absolute inset-y-0 left-[70%] w-[30%] bg-amber-100" /><div className={`absolute inset-y-0 left-0 rounded-full ${statusBar(item?.toleranceStatus)}`} style={{ width: `${Math.min(100, item?.toleranceUtilizationPercent ?? 0)}%` }} /></div><span className="text-right font-mono text-xs font-bold">{item ? `${item.toleranceUtilizationPercent.toFixed(1)}%` : '—'}</span></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><span className="status-success">&lt; 70% acceptable</span><span className="status-warning">70–100% adjustment required</span><span className="status-danger">&gt; 100% out of tolerance</span></div></div>
      <div className="card-flat"><p className="eyebrow">Decision rule</p><h2 className="section-title">Guardband and TUR</h2><div className={`mt-5 rounded-xl p-4 ${tur.passes ? 'bg-emerald-50' : 'bg-rose-50'}`}><div className="flex justify-between gap-3 text-sm"><span>UUT requirement</span><strong>±{formatNumber(tur.uutToleranceAbsolute)} {unit}</strong></div><div className="mt-3 flex justify-between gap-3 text-sm"><span>Calibration uncertainty U (k={uncertainty.coverageFactor})</span><strong>±{formatNumber(tur.calibrationUncertaintyAbsolute)} {unit}</strong></div><div className="mt-3 flex justify-between gap-3 border-t border-slate-300 pt-3 text-sm"><span>TUR, required &gt; {tur.requiredRatio}</span><strong className={tur.passes ? 'text-emerald-700' : 'text-rose-700'}>{Number.isFinite(tur.ratio) ? tur.ratio.toFixed(4) : '∞'} : 1</strong></div></div><p className="mt-4 text-sm leading-6 text-slate-600">A run passes only when <strong>TUR &gt; 3</strong> and every point satisfies <strong>|error| + U ≤ tolerance</strong>. The sensor/UUT requirement and calibration uncertainty are compared in {unit}.</p>{setup.amendmentNote && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"><strong>Amendment:</strong> {setup.amendmentNote}</div>}</div>
    </section>

    <div className="sticky bottom-4 z-10 flex flex-col-reverse justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center"><button type="button" onClick={onCancel} className="btn-tertiary">Back to setup</button><div className="text-right"><button type="button" onClick={finish} disabled={!allValid} className="btn-primary px-7 py-3">Complete calibration →</button>{!allValid && <p className="mt-1 text-xs text-slate-500">{rows.length - completed} reading(s) still missing.</p>}{allValid && <p className={`mt-1 text-xs font-semibold ${passed ? 'text-emerald-700' : 'text-rose-700'}`}>Live result: {passed ? 'passed' : 'failed'}</p>}</div></div>
  </div>;
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 }).format(value);
const formatEditable = (value: number) => value.toFixed(6);
const signed = (value: number, decimals: number) => `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}`;
const statusBackground = (status?: ToleranceStatus) => status === 'danger' ? 'bg-rose-50/70' : status === 'warning' ? 'bg-amber-50/70' : status === 'safe' ? 'bg-emerald-50/40' : '';
const statusBar = (status?: ToleranceStatus) => status === 'danger' ? 'bg-rose-500' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
const LiveMetric = ({ label, value, note, status }: { label: string; value: string; note: string; status?: ToleranceStatus }) => <div className={`metric-card text-left ${status === 'danger' ? 'border-rose-200 bg-rose-50' : status === 'warning' ? 'border-amber-200 bg-amber-50' : status === 'safe' ? 'border-emerald-200 bg-emerald-50' : ''}`}><span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><strong className="mt-1">{value}</strong><span>{note}</span></div>;
const UtilizationBadge = ({ status, utilization }: { status: ToleranceStatus; utilization: number }) => <span className={status === 'danger' ? 'status-danger' : status === 'warning' ? 'status-warning' : 'status-success'}>{utilization.toFixed(1)}% · {status === 'danger' ? 'Out of tolerance' : status === 'warning' ? 'Adjustment required' : 'Acceptable'}</span>;
const conversionExample = (setup: CalibrationSetup) => {
  const index = Math.min(Math.floor(setup.referencePointValues.length / 2), setup.referencePointValues.length - 1);
  if (index < 0) return null;
  const reference = setup.referencePointValues[index];
  const target = setup.measurementPointValues[index];
  if (setup.referenceConversion.mode === 'torque-lever') return <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 font-mono text-sm text-blue-900">Example: {formatNumber(reference)} {setup.referenceConversion.referenceUnit} × {formatNumber(setup.referenceConversion.leverLengthM ?? 0)} m → target {formatNumber(target)} Nm</p>;
  if (setup.referenceConversion.mode === 'calibrated-signal') return <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 font-mono text-sm text-blue-900">Example: set {formatNumber(reference)} {setup.referenceConversion.referenceUnit} → target {formatNumber(target)} {setup.referenceConversion.targetUnit}</p>;
  return null;
};

export default CalibrationProcess;
