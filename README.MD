# Sensor Calibration

A React and TypeScript prototype for guided calibration of complete test-bench measurement chains.

## Direkt ausprobieren — ohne Installation

**[Calibration Studio im Browser öffnen](https://sensor-calibration-studio.mamagnus003.chatgpt.site/)**

Der öffentliche Link funktioniert auf einem Windows-Laptop in Microsoft Edge oder Google Chrome. Es ist kein Konto und keine Installation erforderlich. Die App selbst ist auf Englisch.

1. Einen Prüfstand auswählen und dessen Messstrecken im Setup prüfen.
2. Zum Ausprobieren den Simulationsmodus verwenden und Messwerte simulieren.
3. Ergebnisse, Unsicherheitsbudget und Gain-/Offset-Vorschläge ansehen. Ergebnisse bei Bedarf als CSV exportieren oder den Bericht drucken bzw. als PDF speichern.

Prüfstände und abgeschlossene Ergebnisse werden nur im jeweiligen Browser gespeichert, nicht in einer gemeinsamen Datenbank. Andere Browser oder Geräte haben einen eigenen Verlauf. Das Löschen der Browserdaten entfernt diese Daten; ein privates Browserfenster eignet sich deshalb nicht zum dauerhaften Aufbewahren. Es werden höchstens die letzten 20 Ergebnisse behalten. Ein laufender Messvorgang wird bei einem Neuladen nicht wiederhergestellt: wichtige Ergebnisse vorher exportieren.

Dies ist ein Prototyp zum Testen der Abläufe. Die App verbindet sich nicht mit dem Prüfstand und stellt keine Hardware ein. Geräteprofile, Unsicherheiten und Entscheidungsregeln müssen vor einem offiziellen Einsatz fachlich freigegeben werden.

## Lokal auf einem Windows-Laptop starten

Diese Schritte sind nur nötig, wenn die App lokal statt über den Link laufen soll.

1. **Node.js 22 LTS** von [nodejs.org](https://nodejs.org/en/download) installieren. Die Standardoptionen einschließlich npm und PATH beibehalten. Danach ein eventuell geöffnetes Terminal schließen.
2. Auf [GitHub](https://github.com/MagMueller/sensor-calibration) **Code → Download ZIP** wählen und die ZIP-Datei vollständig entpacken, beispielsweise nach `Dokumente\sensor-calibration-main`.
3. Den entpackten Ordner öffnen, in dem `package.json` liegt. In die Adresszeile des Windows-Explorers `powershell` eingeben und Enter drücken.
4. Einmalig die Abhängigkeiten installieren; dafür ist Internet erforderlich:

   ```powershell
   npm.cmd ci
   ```

5. Die App starten:

   ```powershell
   npm.cmd start
   ```

6. [http://localhost:3000](http://localhost:3000) in Edge oder Chrome öffnen, falls kein Browser automatisch startet. Das Terminal während der Nutzung geöffnet lassen. Zum Beenden im Terminal **Strg+C** drücken.

Beim nächsten Start nur den gleichen Ordner öffnen und `npm.cmd start` ausführen. `npm.cmd` vermeidet die häufige PowerShell-Sperre für `npm.ps1`. Falls „npm.cmd wurde nicht gefunden“ erscheint, Node.js installieren bzw. das Terminal nach der Installation neu öffnen. Falls Port 3000 belegt ist, den alten App-Prozess beenden oder den angebotenen anderen Port verwenden.

Eine neue GitHub-ZIP ersetzt den lokalen Code nicht automatisch. Vor einem Update wichtige Ergebnisse exportieren und anschließend im neuen entpackten Ordner erneut `npm.cmd ci` ausführen. Der lokale Browser-Verlauf und der Verlauf unter dem öffentlichen Link sind getrennt.

Die automatisierten Prüfungen und der Build wurden unter macOS ausgeführt; diese Windows-Anleitung wurde bislang nicht auf einem Windows-Rechner praktisch getestet.

## What the app supports

- Test-bench overview with recent measurements, status, and repeat calibration
- Guided workflow: Test benches → Setup → Measure → Results
- Test bench → measurement path → sensor, amplifier, reference, and PC measurement card
- Equipment IDs, connectors, serial numbers, amplifier channels, and DAQ channels
- Multiple measurement paths per physical sensor, such as torque, angle, and speed
- Add, edit, and remove measurement paths in each test bench
- Device and reference filtering by measured quantity and range
- Default profiles, including 0–250 bar, 0–400 bar, and 10–150 °C
- Editable vertical lists of reference points
- Separate reference setpoint, converted PC target value, and PC reading
- Physical conversions for identity, linear scaling, load cells, turbine flow, mechanical torque, and calibrated electrical signals
- Calibration and simulation modes
- One-click simulated readings, including repeated random simulation
- Live tolerance utilization:
  - below 70%: acceptable
  - 70–100%: adjustment required
  - above 100%: out of tolerance
- Expanded uncertainty budget for reference, amplifier, sensor ageing, temperature, DAQ, display resolution, and optional test-bench-specific influences
- Absolute Test Uncertainty Ratio: `TUR = UUT requirement / calibration uncertainty`; the required ratio is strictly greater than 3
- Guardband decision rule: `|error| + U ≤ tolerance`
- Gain and offset recommendation based on the complete measurement series
- Required verification run after manually applying recommended PC settings
- Zero-point, full-scale, and horizontal deviation-profile views
- CSV export and printable calibration report
- Local protocol issue, amendment reason, and recent result history

Simulation results are explicitly marked as non-official. Applying a recommendation in simulation mode does not persist PC scaling.

## Reference conversions

Reference setpoints are the simple values the technician physically enters. Technical target values are calculated without unnecessary rounding.

Examples:

- Mechanical torque: `M = direction × F × lever length × sin(angle) + tare`
- Mass-based torque: force is calculated first as `F = m × g`
- Turbine flow: `flow = frequency × pulse volume × 60 / 1,000`
- Calibrated signal: an exact certificate value such as `10.01 V = 200 Nm` can produce a precise target for an easy-to-set `10.00 V` input
- Linear conversion: `target = reference × factor + offset`

## Local development

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm test -- --runInBand --watchAll=false
npm run typecheck
npm run build
```

## Prototype limitations

Results and edited test benches are currently stored only in the browser. Production use still requires a backend database, roles and approvals, immutable audit history, certificate management, and an approved uncertainty policy for each test bench.
