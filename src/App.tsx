import { useState } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import CalibrationProcess from './components/CalibrationProcess';
import CalibrationResults from './components/CalibrationResults';
import CalibrationSetupComponent from './components/CalibrationSetup';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import './index.css';
import { AppState, CalibrationResult, CalibrationSetup, MeasurementPoint } from './types';

function App() {
  const [appState, setAppState] = useState<AppState>({
    currentStep: 'dashboard',
    currentMeasurement: 0,
    measurements: [],
    calibrationResults: [],
    canAccessSteps: {
      setup: true,
      calibration: false,
      results: false
    }
  });

  const startCalibration = (setup: CalibrationSetup) => {
    setAppState(prev => ({
      ...prev,
      calibrationSetup: setup,
      currentStep: 'calibration',
      currentMeasurement: 0,
      measurements: [],
      canAccessSteps: {
        setup: true,
        calibration: true,
        results: prev.canAccessSteps.results
      }
    }));
  };

  const addMeasurement = (measurement: MeasurementPoint) => {
    setAppState(prev => ({
      ...prev,
      measurements: [...prev.measurements, measurement],
      currentMeasurement: prev.currentMeasurement + 1
    }));
  };

  const completeCalibration = (result: CalibrationResult) => {
    setAppState(prev => ({
      ...prev,
      calibrationResults: [...prev.calibrationResults, result],
      currentStep: 'results',
      canAccessSteps: {
        setup: true,
        calibration: true,
        results: true
      }
    }));
  };

  const resetToSetup = () => {
    setAppState(prev => ({
      ...prev,
      currentStep: 'setup',
      calibrationSetup: undefined,
      currentMeasurement: 0,
      measurements: []
    }));
  };

  const goToDashboard = () => {
    setAppState(prev => ({
      ...prev,
      currentStep: 'dashboard'
    }));
  };

  const goToSetup = () => {
    if (appState.canAccessSteps.setup) {
      setAppState(prev => ({
        ...prev,
        currentStep: 'setup'
      }));
    }
  };

  const goToCalibration = () => {
    if (appState.canAccessSteps.calibration && appState.calibrationSetup) {
      setAppState(prev => ({
        ...prev,
        currentStep: 'calibration'
      }));
    }
  };

  const goToResults = () => {
    if (appState.canAccessSteps.results && appState.calibrationResults.length > 0) {
      setAppState(prev => ({
        ...prev,
        currentStep: 'results'
      }));
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header 
          currentStep={appState.currentStep}
          canAccessSteps={appState.canAccessSteps}
          onNavigateToDashboard={goToDashboard}
          onNavigateToSetup={goToSetup}
          onNavigateToCalibration={goToCalibration}
          onNavigateToResults={goToResults}
        />
        
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route 
              path="/" 
              element={
                appState.currentStep === 'dashboard' ? (
                  <Dashboard 
                    calibrationResults={appState.calibrationResults}
                    onStartCalibration={() => setAppState(prev => ({ ...prev, currentStep: 'setup' }))}
                  />
                ) : appState.currentStep === 'setup' ? (
                  <CalibrationSetupComponent 
                    onStartCalibration={startCalibration}
                    onCancel={goToDashboard}
                  />
                ) : appState.currentStep === 'calibration' ? (
                  <CalibrationProcess 
                    setup={appState.calibrationSetup!}
                    measurements={appState.measurements}
                    currentMeasurement={appState.currentMeasurement}
                    onAddMeasurement={addMeasurement}
                    onComplete={completeCalibration}
                    onCancel={resetToSetup}
                  />
                ) : appState.currentStep === 'results' ? (
                  <CalibrationResults 
                    result={appState.calibrationResults[appState.calibrationResults.length - 1]}
                    onNewCalibration={resetToSetup}
                    onBackToDashboard={goToDashboard}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 