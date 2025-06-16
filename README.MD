# Kalibrierungs-App

Eine professionelle Web-Anwendung für die Kalibrierung von Messtechnik-Geräten. Die App ermöglicht die systematische Kalibrierung von Sensoren, Verstärkern und Referenzsensoren mit automatischer Berechnung der Gesamtmessungenauigkeit.

## ✨ Features

### 🎯 Hauptfunktionen
- **Geräte-Management**: Auswahl und Konfiguration von Sensoren, Verstärkern und Referenzsensoren
- **Druckbereich-Auswahl**: Verschiedene Druckbereiche (Relativdruck, Absolutdruck, Vakuum, Über-/Unterdruck)
- **Erweiterte Unsicherheitsberechnung**: Geometrische Addition mit Rechteck- oder Normalverteilung
- **Flexible Navigation**: Freies Springen zwischen allen Workflow-Steps
- **Interaktiver Kalibrierungsworkflow**: Schritt-für-Schritt Durchführung mit 10 Messpunkten
- **Toleranzprüfung**: Automatische Bewertung ob Messungen innerhalb der Toleranz liegen
- **Erweiterte Visualisierungen**: Mehrere Diagrammtypen und statistische Auswertungen
- **Export-Funktionen**: PDF-Berichte und CSV-Datenexport

### 📊 Geräte-Datenbank
- **WIKA Sensoren**: P-30, P-31 Präzisions-Drucksensoren
- **Knick Verstärker**: P 27000 Universal-Trennverstärker
- **HBK Referenzsensoren**: K3607 Kalibrier-Einheit

### 🔬 Messtechnik-Features
- **RSS-Unsicherheitsberechnung**: Automatische Berechnung der Gesamtmessungenauigkeit
- **Mehrere Druckbereiche**: 0.25 bar bis 1000 bar
- **Verschiedene Ausgangssignale**: 4-20 mA, 0-20 mA, 0-5 V, 0-10 V, USB, CANopen
- **Flexible Toleranzen**: Einstellbare Toleranzgrenzen von 0.01% bis 10%

## 🚀 Installation und Start

### Voraussetzungen
- Node.js (Version 16 oder höher)
- npm oder yarn
- Moderner Web-Browser

### Installation
```bash
# Repository klonen
git clone [repository-url]
cd papa-app

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm start
```

Die Anwendung ist dann unter `http://localhost:3000` verfügbar.

### Produktions-Build
```bash
# Produktions-Build erstellen
npm run build

# Build testen
npx serve -s build
```

## 📋 Workflow

### 1. Dashboard
- Übersicht der letzten Kalibrierungen
- Statistiken und Status-Übersicht
- Start einer neuen Kalibrierung

### 2. Kalibrierung einrichten
- **Sensor auswählen**: Hersteller, Modell und Spezifikationen
- **Verstärker auswählen**: Signal-Isolator mit Genauigkeitsangaben
- **Referenzsensor auswählen**: Kalibrier-Einheit für Referenzmessungen
- **Messbereich festlegen**: Druckbereich und Messbereichstyp
- **Parameter konfigurieren**: Toleranz und Anzahl Messpunkte

### 3. Messung durchführen
- **Automatische Sollwert-Generierung**: 10 gleichmäßig verteilte Messpunkte
- **Manuelle Istwert-Eingabe**: Eingabe der tatsächlich gemessenen Werte
- **Live-Bewertung**: Sofortige Anzeige ob Wert in Toleranz liegt
- **Fortschritts-Tracking**: Visuelle Fortschrittsanzeige

### 4. Ergebnisse
- **Detaillierte Tabelle**: Alle Messpunkte mit Abweichungen
- **Erweiterte Visualisierungen**: 
  - Abweichungsdiagramm mit Toleranzband
  - Häufigkeitsverteilung (Histogramm)
  - Trendanalyse mit SVG-Grafik
  - Unsicherheits-Aufschlüsselung
- **Erweiterte Statistiken**: Gesamtunsicherheit, Durchschnitt, Maximum, Standardabweichung, Erfolgsrate
- **Export**: PDF-Bericht und CSV-Rohdaten
- **Flexible Navigation**: Direktes Springen zu allen Steps

## 🏗️ Architektur

### Frontend
- **React 18**: Moderne React-Anwendung mit TypeScript
- **Tailwind CSS**: Utility-first CSS Framework
- **Flexible Navigation**: Freies Springen zwischen Workflow-Steps
- **Responsive Design**: Mobile-first Ansatz
- **Erweiterte Visualisierungen**: SVG-Charts, Histogramme, Trendanalyse

### Datenstrukturen
```typescript
// Sensor-Interface
interface Sensor {
  manufacturer: string;
  models: string[];
  measurement_ranges: {
    relative_pressure_bar?: number[];
    absolute_pressure_bar?: number[];
    vacuum_bar?: string[];
    "+/-_pressure_bar"?: string[];
  };
  accuracy: {
    standard_span_percent: number;
    optional_span_percent?: number;
  };
  // ... weitere Eigenschaften
}

// Kalibrierergebnis
interface CalibrationResult {
  setup: CalibrationSetup;
  measurements: MeasurementPoint[];
  totalUncertainty: number;
  passed: boolean;
  createdAt: Date;
}
```

### Erweiterte Unsicherheitsberechnung
Die Gesamtmessungenauigkeit wird nach der GUM-Methode (Guide to the Expression of Uncertainty in Measurement) berechnet:

#### **Verteilungsarten:**
- **Rechteckverteilung**: k = √3 ≈ 1.732 (gleichmäßige Verteilung)
- **Normalverteilung**: k = 2 (Gauß-Verteilung, 95% Vertrauen)

#### **Berechnung:**
```
1. Standardunsicherheiten: ui = Ui / ki
2. Kombinierte Standardunsicherheit: uc = √(u1² + u2² + u3²)
3. Erweiterte Unsicherheit: U = k × uc
```

Wobei:
- `Usensor`: Genauigkeit des Sensors (z.B. ±0.1% vom Messbereich)
- `Uverstärker`: Verstärkungsgenauigkeit (z.B. ±0.08%)
- `Ureferenz`: Genauigkeitsklasse des Referenzsensors (z.B. ±0.025%)
- `k`: Erweiterungsfaktor (2 für 95% Vertrauensbereich)

## 📁 Projektstruktur

```
papa-app/
├── public/                 # Statische Dateien
├── src/
│   ├── components/         # React-Komponenten
│   │   ├── Dashboard.tsx
│   │   ├── CalibrationSetup.tsx
│   │   ├── CalibrationProcess.tsx
│   │   ├── CalibrationResults.tsx
│   │   └── Header.tsx
│   ├── data/              # Daten-Utilities und Geräte-Datenbank
│   │   ├── devices/       # JSON-Geräte-Definitionen
│   │   │   ├── wika.json     # WIKA Sensoren
│   │   │   ├── knick.json    # Knick Verstärker
│   │   │   └── brueel.json   # HBK Referenzsensoren
│   │   └── dataLoader.ts  # Datenbank-Loader mit Unsicherheitsberechnung
│   ├── types/             # TypeScript-Interfaces
│   │   └── index.ts
│   ├── App.tsx            # Haupt-App-Komponente
│   ├── index.tsx          # Einstiegspunkt
│   └── index.css          # Styles
└── package.json
```

## 🔧 Konfiguration

### Neue Geräte hinzufügen
1. JSON-Datei in `src/data/devices/` erstellen (z.B. `neuer-sensor.json`)
2. Datenstruktur entsprechend den TypeScript-Interfaces anpassen
3. In `src/data/dataLoader.ts` importieren und in der `initialize()` Methode registrieren

### Toleranzen anpassen
Die Standard-Toleranz kann in der `CalibrationSetup`-Komponente angepasst werden:
```typescript
const [tolerancePercent, setTolerancePercent] = useState<number>(0.1); // 0.1%
```

## 📊 Unterstützte Messgeräte

### Sensoren
- **WIKA P-30/P-31**: Präzisions-Drucksensoren
  - Messbereiche: 0.25 bar bis 1000 bar
  - Genauigkeit: ±0.1% bzw. ±0.05% vom Messbereich
  - Ausgänge: 4-20 mA, 0-20 mA, 0-5 V, 0-10 V, USB, CANopen

### Verstärker
- **Knick P 27000**: Universal-Trennverstärker
  - Verstärkungsgenauigkeit: ±0.08%
  - Galvanische Trennung: 3-Port-Isolierung
  - Ein-/Ausgangsbereiche: Spannung und Strom

### Referenzsensoren
- **HBK K3607**: Kalibrier-Einheit
  - Genauigkeitsklasse: 0.025
  - Kalibriersignale: 0.05 ... 10 mV/V
  - 30 wählbare Kalibrierungssignale

## 🚀 Deployment

### Development
```bash
npm start
```

### Production
```bash
npm run build
npx serve -s build
```

### Docker (optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npx", "serve", "-s", "build"]
```

## 🤝 Beitragen

1. Fork des Repositories
2. Feature-Branch erstellen (`git checkout -b feature/neue-funktion`)
3. Änderungen committen (`git commit -am 'Neue Funktion hinzugefügt'`)
4. Branch pushen (`git push origin feature/neue-funktion`)
5. Pull Request erstellen

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.

## 🔗 Links

- [WIKA Datenblätter](https://www.wika.de)
- [Knick Elektronik](https://www.knick.de)
- [HBK (Hottinger Brüel & Kjær)](https://www.hbm.com)
- [React Documentation](https://reactjs.org)
- [Tailwind CSS](https://tailwindcss.com)

---

**Erstellt für professionelle Messtechnik-Kalibrierung** 🎯📊⚙️




