import { useEffect, useState } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import CalibrationProcess from './components/CalibrationProcess';
import CalibrationResults from './components/CalibrationResults';
import CalibrationSetupComponent from './components/CalibrationSetup';
import Header from './components/Header';
import Overview from './components/Overview';
import { DataLoader } from './data/dataLoader';
import { savePcSettingsForPath, englishFallback } from './data/benchStorage';
import './index.css';
import { AppState, CalibrationResult, CalibrationSetup } from './types';

const STORAGE_KEY = 'sensor-calibration-results-v5';

const hydrateStoredSetup = (stored: CalibrationSetup): CalibrationSetup => {
  const bench = DataLoader.getTestBenches().find(item => item.id === stored.testBenchId);
  const path = bench?.measurementPaths.find(item => item.id === stored.measurementPathId)
    ?? DataLoader.getTestBenches().flatMap(item => item.measurementPaths).find(item => item.sensorId === stored.sensor.id);
  const sensor = DataLoader.getSensors().find(item => item.id === stored.sensor.id) ?? stored.sensor;
  const amplifier = DataLoader.getAmplifiers().find(item => item.id === stored.amplifier.id) ?? stored.amplifier;
  const referenceSensor = DataLoader.getReferenceSensors().find(item => item.id === stored.referenceSensor.id) ?? stored.referenceSensor;
  const dataAcquisition = DataLoader.getDataAcquisitionDevices().find(item => item.id === stored.dataAcquisition.id) ?? stored.dataAcquisition;
  const selectedRange = sensor.ranges.find(item => item.id === stored.selectedRange.id) ?? stored.selectedRange;
  return {
    ...stored,
    testBenchName: bench ? englishFallback(stored.testBenchName, bench.name) : stored.testBenchName,
    measurementPathName: path ? englishFallback(stored.measurementPathName, path.name) : stored.measurementPathName,
    referenceConversion: path ? {
      ...stored.referenceConversion,
      description: englishFallback(stored.referenceConversion.description, path.conversion.description)
    } : stored.referenceConversion,
    sensor,
    amplifier,
    referenceSensor,
    dataAcquisition,
    selectedRange,
    selectedSensorModel: path ? englishFallback(stored.selectedSensorModel, path.sensorModel) : stored.selectedSensorModel,
    selectedAmplifierModel: path ? englishFallback(stored.selectedAmplifierModel, path.amplifierModel) : stored.selectedAmplifierModel,
    selectedReferenceModel: path ? englishFallback(stored.selectedReferenceModel, path.referenceModel) : stored.selectedReferenceModel,
    selectedDataAcquisitionModel: path ? englishFallback(stored.selectedDataAcquisitionModel, path.dataAcquisitionModel) : stored.selectedDataAcquisitionModel,
    amplifierChannel: stored.amplifierChannel === 'direkt' ? 'direct' : stored.amplifierChannel,
    technician: stored.technician ?? '',
    templateLocked: stored.templateLocked ?? false,
    templateAmendmentHistory: stored.templateAmendmentHistory ?? []
  };
};

const loadResults = (): CalibrationResult[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CalibrationResult[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(result => {
      const setup: CalibrationSetup = hydrateStoredSetup({
        ...result.setup,
        dataAcquisitionBmk: result.setup.dataAcquisitionBmk ?? '—',
        displayResolution: result.setup.displayResolution ?? DataLoader.getDefaultDisplayResolution(result.setup.selectedRange),
        pcGain: result.setup.pcGain ?? 1,
        pcOffset: result.setup.pcOffset ?? 0,
        additionalUncertainties: result.setup.additionalUncertainties ?? []
      });
      const measurements = result.measurements.map(point => ({ ...point, timestamp: new Date(point.timestamp) }));
      const totalUncertainty = DataLoader.calculateTotalUncertainty(setup);
      const tur = DataLoader.calculateTur(setup, totalUncertainty);
      const passed = tur.passes && measurements.every(point => DataLoader.passesGuardband(point.abweichungPercent, totalUncertainty, setup.tolerancePercent));
      return {
        ...result,
        setup,
        technician: result.technician ?? setup.technician ?? '',
        createdAt: new Date(result.createdAt),
        measurements,
        totalUncertainty,
        passed
      };
    });
  } catch {
    return [];
  }
};

function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    const calibrationResults = loadResults();
    return {
      currentStep: 'overview',
      calibrationQueue: [],
      currentRunResults: [],
      calibrationResults,
      canAccessSteps: {
        setup: true,
        calibration: false,
        results: calibrationResults.length > 0
      }
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.calibrationResults.slice(-20)));
  }, [appState.calibrationResults]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [appState.currentStep]);

  const beginSetup = (benchId?: string) => {
    setAppState(prev => ({
      ...prev,
      currentStep: 'setup',
      setupBenchId: benchId,
      calibrationSetup: undefined,
      calibrationQueue: [],
      currentRunResults: [],
      canAccessSteps: {
        setup: true,
        calibration: false,
        results: prev.calibrationResults.length > 0
      }
    }));
  };

  const goToOverview = () => setAppState(prev => ({ ...prev, currentStep: 'overview' }));

  const startCalibration = (setups: CalibrationSetup[]) => {
    const [setup, ...queue] = setups;
    if (!setup) return;
    setAppState(prev => ({
      ...prev,
      calibrationSetup: setup,
      calibrationQueue: queue,
      currentRunResults: [],
      currentStep: 'calibration',
      canAccessSteps: {
        setup: true,
        calibration: true,
        results: prev.calibrationResults.length > 0
      }
    }));
  };

  const completeCalibration = (result: CalibrationResult) => {
    setAppState(prev => {
      const [nextSetup, ...remainingQueue] = prev.calibrationQueue;
      return {
        ...prev,
        calibrationResults: [...prev.calibrationResults, result],
        currentRunResults: [...prev.currentRunResults, result],
        calibrationSetup: nextSetup,
        calibrationQueue: remainingQueue,
        currentStep: nextSetup ? 'calibration' : 'results',
        canAccessSteps: { setup: true, calibration: Boolean(nextSetup), results: true }
      };
    });
  };

  const startVerification = (source: CalibrationResult, pcGain: number, pcOffset: number) => {
    if (source.setup.runMode === 'calibration') {
      savePcSettingsForPath(source.setup.testBenchId, source.setup.measurementPathId, pcGain, pcOffset);
    }
    startCalibration([{
      ...source.setup,
      pcGain,
      pcOffset,
      amendmentNote: `Verification after PC adjustment: gain ${source.setup.pcGain.toFixed(6)} → ${pcGain.toFixed(6)}, offset ${source.setup.pcOffset.toFixed(6)} → ${pcOffset.toFixed(6)} ${source.setup.selectedRange.unit}.`
    }]);
  };

  const goToCalibration = () => {
    if (!appState.canAccessSteps.calibration || !appState.calibrationSetup) return;
    setAppState(prev => ({ ...prev, currentStep: 'calibration' }));
  };
  const goToResults = () => {
    if (!appState.calibrationResults.length) return;
    setAppState(prev => ({ ...prev, currentStep: 'results' }));
  };

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen text-slate-900">
        <Header
          currentStep={appState.currentStep}
          canAccessSteps={appState.canAccessSteps}
          onNavigateToOverview={goToOverview}
          onNavigateToSetup={() => beginSetup()}
          onNavigateToCalibration={goToCalibration}
          onNavigateToResults={goToResults}
        />
        <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:py-9">
          <Routes>
            <Route path="/" element={
              appState.currentStep === 'overview' ? (
                <Overview calibrationResults={appState.calibrationResults} onOpenBench={beginSetup} />
              ) : appState.currentStep === 'setup' ? (
                <CalibrationSetupComponent key={appState.setupBenchId ?? 'new'} initialBenchId={appState.setupBenchId} onStartCalibration={startCalibration} />
              ) : appState.currentStep === 'calibration' && appState.calibrationSetup ? (
                <CalibrationProcess
                  key={appState.calibrationSetup.measurementPathId}
                  setup={appState.calibrationSetup}
                  remainingPaths={appState.calibrationQueue.length}
                  onComplete={completeCalibration}
                  onCancel={beginSetup}
                />
              ) : appState.currentStep === 'results' && appState.calibrationResults.length ? (
                <CalibrationResults
                  results={appState.currentRunResults.length ? appState.currentRunResults : [appState.calibrationResults[appState.calibrationResults.length - 1]]}
                  onNewCalibration={() => beginSetup(resultBenchId(appState))}
                  onStartVerification={startVerification}
                  onBackToOverview={goToOverview}
                />
              ) : <Navigate to="/" replace />
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

const resultBenchId = (state: AppState) => state.currentRunResults[state.currentRunResults.length - 1]?.setup.testBenchId
  ?? state.calibrationResults[state.calibrationResults.length - 1]?.setup.testBenchId;

export default App;
