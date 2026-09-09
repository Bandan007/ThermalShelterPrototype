// Prototype Climate Grid Data
// Derived and simplified for web execution. Includes selected grid points from WorldClim 2.1 IND dataset at 0.5-degree resolution[span_0](start_span)[span_0](end_span) for northern regions, combined with prototype nodes for standard demo cities.

const climateGrid = [
    // Predefined prototype nodes for demo cities (synthetic/simplified data)
    { lat: 22.57, lon: 88.36, temp: 31.5, rh: 78, name: "Kolkata" },
    { lat: 26.91, lon: 75.78, temp: 38.2, rh: 25, name: "Jaipur" },
    { lat: 28.61, lon: 77.20, temp: 34.0, rh: 45, name: "Delhi" },
    { lat: 19.07, lon: 72.87, temp: 32.0, rh: 82, name: "Mumbai" },
    { lat: 34.15, lon: 77.57, temp: 12.0, rh: 30, name: "Leh (Ladakh)" },
    
    // Sample Northern India/Himalayan grid points extracted from WorldClim IND 30s dataset[span_1](start_span)[span_1](end_span)
    { lat: 35.75, lon: 77.25, temp: -4.6, rh: 40, name: "Grid Node N1" },
    { lat: 35.75, lon: 74.25, temp: -0.7, rh: 45, name: "Grid Node N2" },
    { lat: 35.25, lon: 72.25, temp: 11.1, rh: 55, name: "Grid Node N3" },
    { lat: 34.75, lon: 69.75, temp: 12.7, rh: 50, name: "Grid Node N4" },
    { lat: 34.25, lon: 70.75, temp: 19.7, rh: 60, name: "Grid Node N5" }
];
Here is the complete code for your Smart India Hackathon prototype. The project is separated into the standard web stack (HTML, CSS, Vanilla JS) and modular data files to ensure it runs completely in the browser without a backend or build tools.

### 1. `index.html`
Save this in your root folder.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Area-Specific Thermal Shelter Design System</title>
    
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="[https://unpkg.com/leaflet@1.9.4/dist/leaflet.css](https://unpkg.com/leaflet@1.9.4/dist/leaflet.css)" />
    <!-- Custom CSS -->
    <link rel="stylesheet" href="style.css" />
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-titles">
            <h1>Area-Specific Thermal Shelter Design System</h1>
            <p>GIS-assisted climate analysis and optimized shelter recommendations</p>
        </div>
        <div class="header-badges">
            <span class="badge">GIS + Thermal Model</span>
            <span class="badge prototype-badge">Prototype • Smart India Hackathon</span>
        </div>
    </header>

    <!-- Main Layout -->
    <div class="dashboard-container">
        <!-- Left Sidebar: Controls -->
        <aside class="sidebar">
            <div class="card">
                <h2>Demo Locations</h2>
                <p class="small-text">Select a pre-configured location for a quick demonstration.</p>
                <select id="demo-location-select" onchange="loadDemoLocation()">
                    <option value="">-- Select Location --</option>
                </select>
            </div>

            <div class="card">
                <h2>Location Analysis</h2>
                <div class="input-group">
                    <label>Latitude:</label>
                    <input type="number" id="lat-input" step="0.0001" readonly>
                </div>
                <div class="input-group">
                    <label>Longitude:</label>
                    <input type="number" id="lon-input" step="0.0001" readonly>
                </div>
                <div class="input-group">
                    <label>Temperature (°C):</label>
                    <input type="number" id="temp-input" step="0.1">
                </div>
                <div class="input-group">
                    <label>Humidity (%):</label>
                    <input type="number" id="hum-input" step="1">
                </div>
                <div id="climate-class-display" class="highlight-box">
                    Climate: Waiting for data...
                </div>
            </div>

            <div class="card">
                <h2>Material Availability</h2>
                <div class="checkbox-grid" id="material-checkboxes">
                    <!-- Checkboxes injected via JS -->
                </div>
            </div>

            <button id="generate-btn" class="primary-btn" onclick="runOptimization()">GENERATE OPTIMAL DESIGN</button>
            <button id="presentation-mode-btn" class="secondary-btn" onclick="togglePresentationMode()">Toggle Presentation Mode</button>
        </aside>

        <!-- Center: Map -->
        <main class="map-container">
            <div id="map"></div>
            <div class="map-legend">
                <strong>Avg Temperature</strong><br>
                <span style="color:#2b83ba">■</span> &lt;15°C (Cold)<br>
                <span style="color:#abdda4">■</span> 15–25°C (Moderate)<br>
                <span style="color:#fdae61">■</span> 25–30°C (Warm)<br>
                <span style="color:#d7191c">■</span> &gt;30°C (Hot)
            </div>
        </main>

        <!-- Right Sidebar: Results & Architecture -->
        <aside class="results-panel" id="results-panel">
            <div class="card architecture-card">
                <h2>Optimization Engine</h2>
                <p><strong>Current:</strong> Rule-based thermal optimization</p>
                <p><strong>Future:</strong> ML-based thermal performance prediction</p>
                <p class="disclaimer">Prototype estimates are intended for demonstration and should not be used as a substitute for certified building design.</p>
            </div>

            <div id="recommendation-card" class="card hidden">
                <h2>OPTIMAL SHELTER DESIGN</h2>
                <p id="eval-count" class="small-text eval-count">Evaluated 120 design configurations</p>
                
                <div class="result-grid">
                    <div><strong>Climate:</strong> <span id="res-climate"></span></div>
                    <div><strong>Comfort Score:</strong> <span id="res-comfort"></span>/100</div>
                    <div><strong>Wall Material:</strong> <span id="res-wall"></span></div>
                    <div><strong>Roof Material:</strong> <span id="res-roof"></span></div>
                    <div><strong>Insulation:</strong> <span id="res-insulation"></span> mm</div>
                    <div><strong>Ventilation:</strong> <span id="res-ventilation"></span></div>
                    <div><strong>Shading:</strong> <span id="res-shading"></span></div>
                    <div><strong>Thermal Mass:</strong> <span id="res-mass"></span></div>
                </div>

                <div class="thermal-estimation">
                    <p>Outdoor Temp: <span id="res-out-temp"></span>°C</p>
                    <p>Estimated Indoor Temp: <strong><span id="res-in-temp"></span>°C</strong></p>
                    <p class="small-text">(Prototype thermal estimation)</p>
                </div>
            </div>

            <div id="comparison-card" class="card hidden">
                <h2>DESIGN COMPARISON</h2>
                <canvas id="comparisonChart" width="100" height="60"></canvas>
                <p id="improvement-text" class="improvement-highlight"></p>
            </div>
        </aside>
    </div>

    <!-- Scripts -->
    <script src="[https://unpkg.com/leaflet@1.9.4/dist/leaflet.js](https://unpkg.com/leaflet@1.9.4/dist/leaflet.js)"></script>
    <script src="[https://cdn.jsdelivr.net/npm/chart.js](https://cdn.jsdelivr.net/npm/chart.js)"></script>
    
    <!-- Data Modules -->
    <script src="data/demoLocations.js"></script>
    <script src="data/climate.js"></script>
    <script src="data/materials.js"></script>
    
    <!-- App Logic -->
    <script src="app.js"></script>
</body>
</html>
