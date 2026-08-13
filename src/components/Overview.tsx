import { useMemo, useState } from 'react';
import { DataLoader } from '../data/dataLoader';
import { loadLocalBenches, mergeBenchCatalog } from '../data/benchStorage';
import { CalibrationResult, MeasurementPath, TestBench } from '../types';

interface Props {
  calibrationResults: CalibrationResult[];
  onOpenBench: (benchId: string) => void;
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
const quantityLabel = (value: string) => ({ pressure: 'Pressure', temperature: 'Temperature', force: 'Force', torque: 'Torque', speed: 'Speed', flow: 'Flow', angle: 'Angle', voltage: 'Voltage', current: 'Current', electrical: 'Electrical' }[value] ?? value);

const Overview = ({ calibrationResults, onOpenBench }: Props) => {
  const [view, setView] = useState<'benches' | 'history'>('benches');
  const benches = useMemo(() => mergeBenchCatalog(DataLoader.getTestBenches(), loadLocalBenches()), []);
  const sortedResults = useMemo(() => [...calibrationResults].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), [calibrationResults]);
  const pathCount = benches.reduce((sum, bench) => sum + bench.measurementPaths.length, 0);

  return <div className="space-y-6">
    <header className="overview-hero">
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Calibration workspace</p><h1 className="max-w-3xl text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Choose a test bench.<br className="hidden sm:block" /> Continue where you left off.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Annual calibrations, approved measurement paths, and traceable results in one operational view.</p></div><div className="grid grid-cols-3 gap-4 sm:gap-7"><OverviewStat label="Benches" value={benches.length} /><OverviewStat label="Paths" value={pathCount} /><OverviewStat label="Records" value={calibrationResults.length} /></div></div>
    </header>

    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">Workspace</p><h2 className="section-title">{view === 'benches' ? 'Configured test benches' : 'Recent measurement records'}</h2></div><div className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1 shadow-sm"><button type="button" className={`rounded-md px-4 py-2 text-sm font-bold transition ${view === 'benches' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`} onClick={() => setView('benches')}>Test benches</button><button type="button" className={`rounded-md px-4 py-2 text-sm font-bold transition ${view === 'history' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`} onClick={() => setView('history')}>History</button></div></div>

    {view === 'benches' ? <section className="grid items-start gap-4 xl:grid-cols-2">{benches.map(bench => <BenchCard key={bench.id} bench={bench} results={sortedResults.filter(result => result.setup.testBenchId === bench.id)} onOpen={() => onOpenBench(bench.id)} />)}</section> : <History results={sortedResults} onOpenBench={onOpenBench} />}
  </div>;
};

const BenchCard = ({ bench, results, onOpen }: { bench: TestBench; results: CalibrationResult[]; onOpen: () => void }) => {
  const officialResults = results.filter(result => result.setup.runMode === 'calibration');
  const last = officialResults[0];
  const latestSimulation = results.find(result => result.setup.runMode === 'simulation');
  const groups = groupPaths(bench.measurementPaths);
  const hasMultiOutputSensor = groups.some(group => group.paths.length > 1);
  const renderPath = (path: MeasurementPath) => {
    const previous = officialResults.find(result => result.setup.measurementPathId === path.id);
    return <div key={path.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5"><div className="min-w-0"><strong className="block truncate text-[13px] text-slate-800">{path.name}</strong><span className="block truncate text-[11px] text-slate-500">{quantityLabel(path.measurand)} · {path.sensorBmk}</span></div><span className="text-right text-[11px] font-semibold text-slate-500">{previous ? formatDate(previous.createdAt) : 'Due'}</span></div>;
  };
  return <article className="card-flat bench-card flex flex-col pl-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Issue {bench.revision}</span><span className={bench.locked ? 'status-success' : 'status-warning'}>{bench.locked ? 'Locked' : 'Draft'}</span></div><h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{bench.name}</h2><p className="mt-1.5 text-sm leading-5 text-slate-500">{bench.description}</p></div>{last ? <span className={`${last.passed ? 'status-success' : 'status-danger'} self-start`}>{last.passed ? 'Passed' : 'Failed'}</span> : <span className="status-neutral self-start">Not tested</span>}</div>
    <div className="mt-5">{hasMultiOutputSensor ? <div className="space-y-3">{groups.map(group => <div key={group.id}><div className="mb-1.5 flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"><span>{group.name}</span><span>{group.paths.length} path{group.paths.length === 1 ? '' : 's'}</span></div><div className="bench-path-list">{group.paths.map(renderPath)}</div></div>)}</div> : <div className="bench-path-list">{bench.measurementPaths.map(renderPath)}</div>}</div>
    <div className="mt-auto flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-[11px] leading-4 text-slate-500">{last ? `Last official run ${formatDate(last.createdAt)} · ${last.technician || last.setup.technician || 'Unknown technician'}` : latestSimulation ? `Latest simulation ${formatDate(latestSimulation.createdAt)} · no official result` : `${bench.measurementPaths.length} configured path(s)`}<span className="block">{bench.amendmentHistory?.length ?? 0} amendment record(s)</span></span><button type="button" className="btn-primary whitespace-nowrap" onClick={onOpen}>{results.length ? 'Open & calibrate' : 'Open test bench'} →</button></div>
  </article>;
};

const History = ({ results, onOpenBench }: { results: CalibrationResult[]; onOpenBench: (benchId: string) => void }) => <section className="card-flat"><div className="mb-5"><p className="eyebrow">History</p><h2 className="section-title">Recent measurements</h2></div>{results.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Date</th><th>Technician</th><th>Test bench</th><th>Measurement path</th><th>Issue</th><th>Mode</th><th>Status</th><th></th></tr></thead><tbody>{results.map((result, index) => <tr key={`${result.createdAt.toISOString()}-${index}`}><td>{formatDate(result.createdAt)}</td><td><strong>{result.technician || result.setup.technician || 'Unknown'}</strong></td><td><strong>{result.setup.testBenchName}</strong></td><td>{result.setup.measurementPathName}<span>{quantityLabel(result.setup.sensor.measurand)} · {result.setup.sensorBmk}</span></td><td>{result.setup.protocolIssue}</td><td><span className={result.setup.runMode === 'simulation' ? 'status-warning' : 'status-neutral'}>{result.setup.runMode === 'simulation' ? 'Simulation' : 'Official'}</span></td><td><span className={result.passed ? 'status-success' : 'status-danger'}>{result.passed ? 'Passed' : 'Failed'}</span></td><td><button type="button" className="btn-tertiary whitespace-nowrap" onClick={() => onOpenBench(result.setup.testBenchId)}>Repeat</button></td></tr>)}</tbody></table></div> : <div className="empty-state">No measurements saved yet. Open a test bench and complete the first calibration.</div>}</section>;

const groupPaths = (paths: MeasurementPath[]) => {
  const groups = new Map<string, { id: string; name: string; paths: MeasurementPath[] }>();
  paths.forEach(path => {
    const id = path.physicalSensorId ?? path.id;
    const current = groups.get(id) ?? { id, name: path.physicalSensorName ?? path.sensorModel, paths: [] };
    current.paths.push(path);
    groups.set(id, current);
  });
  return Array.from(groups.values());
};

const OverviewStat = ({ label, value }: { label: string; value: number }) => <div className="overview-stat"><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>;

export default Overview;
