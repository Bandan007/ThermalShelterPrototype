let map, marker, chartInstance = null;
let climateData = [];

let currentSelection = {
    lat: null,
    lon: null,
    temp: null,
    humidity: null,
    climateClass: null,
    humidityLoading: false,
    windSpeed: null,
    solarRadiation: null
};

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    populateDemoDropdown();
    populateMaterials();
    loadDataDirectly();
});


function initMap() {
    map = L.map('map', {
        preferCanvas: true
    }).setView([22.0, 79.0], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    setTimeout(() => {
        map.invalidateSize();
    }, 500);

    map.on('click', e => {
        selectLocation(e.latlng.lat, e.latlng.lng);
    });
}


/* =========================
   TEMPERATURE DATA
========================= */

function loadDataDirectly() {

    if (typeof rawClimateData !== 'undefined' && rawClimateData.points) {

        let minRawLat = Infinity;
        let maxRawLat = -Infinity;
        let minRawLon = Infinity;
        let maxRawLon = -Infinity;

        rawClimateData.points.forEach(pt => {

            let rLat = Math.min(pt.lat, pt.lon);
            let rLon = Math.max(pt.lat, pt.lon);

            if (rLat < minRawLat) minRawLat = rLat;
            if (rLat > maxRawLat) maxRawLat = rLat;

            if (rLon < minRawLon) minRawLon = rLon;
            if (rLon > maxRawLon) maxRawLon = rLon;
        });

        const INDIA_MIN_LAT = 8.0;
        const INDIA_MAX_LAT = 37.0;
        const INDIA_MIN_LON = 68.0;
        const INDIA_MAX_LON = 97.0;

        climateData = rawClimateData.points.map(pt => {

            let rLat = Math.min(pt.lat, pt.lon);
            let rLon = Math.max(pt.lat, pt.lon);

            let scaledLat =
                INDIA_MIN_LAT +
                ((rLat - minRawLat) /
                    (maxRawLat - minRawLat)) *
                (INDIA_MAX_LAT - INDIA_MIN_LAT);

            let scaledLon =
                INDIA_MIN_LON +
                ((rLon - minRawLon) /
                    (maxRawLon - minRawLon)) *
                (INDIA_MAX_LON - INDIA_MIN_LON);

            return {
                lat: scaledLat,
                lon: scaledLon,
                annual: pt.annual
            };
        });

        renderClimateLayer();

    } else {

        alert(
            "Could not read rawClimateData. Make sure data/india_temperature.js is included in index.html"
        );
    }
}


function renderClimateLayer() {

    climateData.forEach(pt => {

        const temp = pt.annual;

        const color =
            temp < 15
                ? '#2b83ba'
                : temp < 25
                    ? '#abdda4'
                    : temp < 30
                        ? '#fdae61'
                        : '#d7191c';

        L.circleMarker([pt.lat, pt.lon], {
            radius: 2,
            color: color,
            fillColor: color,
            fillOpacity: 0.6,
            stroke: false
        }).addTo(map);
    });
}


function getNearestClimatePoint(lat, lon) {

    let nearest = climateData[0];
    let minDist = Infinity;

    climateData.forEach(pt => {

        const dist = Math.hypot(
            pt.lat - lat,
            pt.lon - lon
        );

        if (dist < minDist) {
            minDist = dist;
            nearest = pt;
        }
    });

    return nearest;
}


/* =========================
   LOCATION SELECTION
========================= */

async function selectLocation(lat, lon) {

    if (marker) {
        map.removeLayer(marker);
    }

    marker = L.marker([lat, lon]).addTo(map);

    map.flyTo(
        [lat, lon],
        7,
        {
            duration: 0.5
        }
    );

    if (climateData.length === 0) {
        return;
    }

    const nearest = getNearestClimatePoint(lat, lon);

    currentSelection.lat = lat;
    currentSelection.lon = lon;
    currentSelection.temp = nearest.annual;

    currentSelection.humidity = null;
    currentSelection.humidityLoading = true;

    document.getElementById('lat-input').value =
        lat.toFixed(4);

    document.getElementById('lon-input').value =
        lon.toFixed(4);

    document.getElementById('temp-input').value =
        nearest.annual;

    document.getElementById('hum-input').value = '';

    const status =
        document.getElementById('humidity-status');

    if (status) {
        status.innerText =
            'Fetching RH2M from NASA POWER...';

        status.className =
            'api-status loading';
    }

    currentSelection.climateClass =
        nearest.annual < 15
            ? "COLD"
            : nearest.annual > 25
                ? "HOT"
                : "MODERATE";

    const climateDisplay =
        document.getElementById(
            'climate-class-display'
        );

    if (climateDisplay) {
        climateDisplay.innerText =
            `Climate: ${currentSelection.climateClass}`;
    }

    await fetchNASAHumidity(lat, lon);
}


/* =========================
   NASA POWER RH2M
========================= */

async function fetchNASAHumidity(lat, lon) {

    const nasaURL =
        new URL(
            'https://power.larc.nasa.gov/api/temporal/climatology/point'
        );

    nasaURL.searchParams.set(
    'parameters',
    'RH2M,WS10M,ALLSKY_SFC_SW_DWN'
);

    nasaURL.searchParams.set(
        'community',
        'SB'
    );

    nasaURL.searchParams.set(
        'longitude',
        lon.toFixed(4)
    );

    nasaURL.searchParams.set(
        'latitude',
        lat.toFixed(4)
    );

    nasaURL.searchParams.set(
        'format',
        'JSON'
    );


    /*
     * Try NASA POWER directly first.
     * If the browser blocks the request because of CORS,
     * use a public CORS relay as fallback.
     */

    const directURL = nasaURL.toString();

    const proxyURL =
        'https://api.allorigins.win/raw?url=' +
        encodeURIComponent(directURL);


    let data = null;
    let lastError = null;


    /* ---------- ATTEMPT 1: DIRECT NASA POWER ---------- */

    try {

        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () => controller.abort(),
                10000
            );

        const response =
            await fetch(
                directURL,
                {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-store',
                    signal: controller.signal
                }
            );

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(
                `NASA POWER HTTP ${response.status}`
            );
        }

        data = await response.json();

    } catch (error) {

        lastError = error;

        console.warn(
            'Direct NASA POWER request failed. Trying CORS fallback...',
            error
        );
    }


    /* ---------- ATTEMPT 2: CORS FALLBACK ---------- */

    if (!data) {

        try {

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () => controller.abort(),
                    15000
                );

            const response =
                await fetch(
                    proxyURL,
                    {
                        method: 'GET',
                        cache: 'no-store',
                        signal: controller.signal
                    }
                );

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(
                    `CORS relay HTTP ${response.status}`
                );
            }

            data = await response.json();

        } catch (error) {

            lastError = error;

            console.error(
                'NASA POWER humidity request failed:',
                error
            );
        }
    }


    /* ---------- PROCESS RESULT ---------- */

    if (!data) {

        currentSelection.humidityLoading = false;
        currentSelection.humidity = null;

        document.getElementById(
            'hum-input'
        ).value = '';

        const status =
            document.getElementById(
                'humidity-status'
            );

        if (status) {

            status.innerText =
                'NASA POWER humidity could not be loaded. Check internet connection and try again.';

            status.className =
                'api-status error';
        }

        return;
    }


    try {

        const rhData =
            data?.properties?.parameter?.RH2M;

        if (!rhData) {
            throw new Error(
                'RH2M data missing from NASA POWER response.'
            );
        }
/* ---------- NASA POWER CLIMATE DATA ---------- */

const windData =
    data?.properties?.parameter?.WS10M;

const solarData =
    data?.properties?.parameter?.ALLSKY_SFC_SW_DWN;


/*
 * Wind speed
 */

const annualWind =
    Number(windData?.ANN);


/*
 * NASA POWER ALLSKY_SFC_SW_DWN
 * is climatological solar energy in
 * kWh/m²/day.
 *
 * Convert it to average W/m² so the
 * thermal model can use it.
 */

const annualSolar =
    Number(solarData?.ANN);

const averageSolarWm2 =
    Number.isFinite(annualSolar)
        ? (annualSolar * 1000) / 24
        : 500;


/*
 * Store the values for the thermal model.
 */

currentSelection.windSpeed =
    Number.isFinite(annualWind)
        ? annualWind
        : 1;

currentSelection.solarRadiation =
    averageSolarWm2;


console.log(
    'NASA POWER Wind:',
    currentSelection.windSpeed,
    'm/s'
);

console.log(
    'NASA POWER Solar:',
    currentSelection.solarRadiation,
    'W/m²'
);
console.log(
    "RAW NASA SOLAR DATA:",
    solarData
);

console.log(
    "RAW ANNUAL SOLAR:",
    annualSolar
);
        /*
         * NASA POWER climatology returns:
         *
         * RH2M:
         * {
         *   JAN: ...,
         *   FEB: ...,
         *   ...
         *   DEC: ...,
         *   ANN: ...
         * }
         *
         * We use ANN = annual climatological
         * relative humidity.
         */

        const annualRH =
            Number(rhData.ANN);


        if (!Number.isFinite(annualRH)) {

            throw new Error(
                'NASA POWER returned an invalid RH2M annual value.'
            );
        }


        currentSelection.humidity =
            Math.round(
                annualRH * 10
            ) / 10;

        currentSelection.humidityLoading =
            false;


        document.getElementById(
            'hum-input'
        ).value =
            currentSelection.humidity;


        const status =
            document.getElementById(
                'humidity-status'
            );

        if (status) {

            status.innerText =
                'NASA POWER • RH2M annual climatology';

            status.className =
                'api-status success';
        }


        console.log(
            'NASA POWER RH2M:',
            currentSelection.humidity + '%'
        );


    } catch (error) {

        currentSelection.humidityLoading =
            false;

        currentSelection.humidity =
            null;

        document.getElementById(
            'hum-input'
        ).value = '';

        const status =
            document.getElementById(
                'humidity-status'
            );

        if (status) {

            status.innerText =
                'NASA POWER returned an invalid humidity value.';

            status.className =
                'api-status error';
        }

        console.error(
            'Invalid NASA POWER response:',
            error
        );
    }
}


/* =========================
   DEMO LOCATIONS
========================= */

function populateDemoDropdown() {

    const select =
        document.getElementById(
            'demo-location-select'
        );

    if (!select) return;

    demoLocations.forEach(
        (loc, index) => {

            const opt =
                document.createElement(
                    'option'
                );

            opt.value = index;

            opt.innerText =
                loc.name;

            select.appendChild(opt);
        }
    );
}


function loadDemoLocation() {

    const val =
        document.getElementById(
            'demo-location-select'
        ).value;

    if (val !== "") {

        selectLocation(
            demoLocations[val].lat,
            demoLocations[val].lon
        );
    }
}


/* =========================
   MATERIALS
========================= */

function populateMaterials() {

    const container =
        document.getElementById(
            'material-checkboxes'
        );

    if (!container) return;

    materialDatabase.forEach(
        mat => {

            container.innerHTML +=
                `<label>
                    <input
                        type="checkbox"
                        value="${mat.name}"
                        checked
                    >
                    ${mat.name}
                </label>`;
        }
    );
}


/* =========================
   OPTIMIZATION
========================= */

function runOptimization() {

    const tempVal =
        document.getElementById(
            'temp-input'
        ).value;


    if (!tempVal) {

        alert(
            "Select a location on the map first."
        );

        return;
    }


    if (currentSelection.humidityLoading) {

        alert(
            "Humidity data is still being fetched from NASA POWER. Please wait a moment."
        );

        return;
    }


    if (currentSelection.humidity === null) {

        alert(
            "NASA POWER humidity data could not be loaded. Select the location again and retry."
        );

        return;
    }


    const temp =
        parseFloat(tempVal);

    const humidity =
        currentSelection.humidity;


    /*
     * Comfort score.
     *
     * Temperature contributes to the score.
     * High humidity reduces thermal comfort,
     * especially in hot climates.
     */

    let score;

    if (temp > 30) {

        score = 82;

    } else if (temp < 15) {

        score = 85;

    } else {

        score = 92;
    }


    /*
     * Humidity adjustment
     */

    if (humidity >= 80) {

        score -= 8;

    } else if (humidity >= 70) {

        score -= 5;

    } else if (humidity >= 60) {

        score -= 3;

    } else if (humidity < 30) {

        score -= 2;
    }


    score =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(score)
            )
        );


    /* ---------- RESULT CARD ---------- */

    document
        .getElementById(
            'recommendation-card'
        )
        .classList
        .remove('hidden');


    document.getElementById(
        'res-climate'
    ).innerText =
        currentSelection.climateClass;


    document.getElementById(
        'res-comfort'
    ).innerText =
        score;


    document.getElementById(
        'res-wall'
    ).innerText =
        temp < 15
            ? "Stone / Compressed Earth"
            : humidity > 70
                ? "Brick / AAC Block"
                : "Brick / Concrete";


    document.getElementById(
        'res-roof'
    ).innerText =
        humidity > 70
            ? "Insulated + Ventilated Roof"
            : "Insulated Panel";
  
    /* ---------- THERMAL SIMULATION ---------- */

    /*
     * Build the climate input for the thermal model.
     *
     * We keep the existing NASA POWER humidity value.
     * Wind and solar will use available values when present,
     * otherwise the thermal model uses safe prototype defaults.
     */

    const thermalClimate = {

        temperature: temp,

        humidity: humidity,

        windSpeed:
            Number(currentSelection.windSpeed) || 1,

        solarRadiation:
            Number(currentSelection.solarRadiation) || 500
    };


    /*
     * Select thermal properties according to
     * the existing recommended design.
     */

    let selectedWall;

    if (temp < 15) {

        selectedWall =
            materialDatabase.find(
                m => m.name === "Mud/Adobe"
            ) ||
            materialDatabase.find(
                m => m.name === "Brick"
            ) ||
            materialDatabase[0];

    } else {

        selectedWall =
            materialDatabase.find(
                m => m.name === "Brick"
            ) ||
            materialDatabase[0];
    }


    const selectedRoof =
        materialDatabase.find(
            m => m.name === "Insulated Panel"
        ) ||
        materialDatabase[0];


    /*
     * Create the shelter design parameters.
     */

    const thermalDesign = {

        floorArea: 20,

        height: 3,

        wallThickness:
            temp < 15 ? 0.30 : 0.20,

        roofThickness:
            temp < 15 ? 0.20 : 0.15,

        wallConductivity:
            selectedWall.thermalConductivity,

        roofConductivity:
            selectedRoof.thermalConductivity,

        windowArea: 2,

        openingRatio:
            humidity > 70 ? 0.15 : 0.10,

        windowU: 2.8,

        solarGainFactor:
            temp < 15 ? 0.70 : 0.50,

        /*
         * Thermal mass in J/K.
         * Higher thermal mass slows indoor
         * temperature changes.
         */

        thermalMass:
            temp < 15
                ? 800000
                : 600000
    };


    /*
     * Run the 24-hour thermal simulation.
     */

    const thermalResult =
        simulateThermalPerformance(
            thermalDesign,
            thermalClimate
        );


    const thermalSummary =
        thermalResult.summary;


    console.log(
        "24-HOUR THERMAL SIMULATION:",
        thermalResult
    );


    /* ---------- THERMAL RESULTS CARD ---------- */

    let thermalCard =
        document.getElementById(
            'thermal-results-card'
        );


    /*
     * Create the card only once.
     */

    if (!thermalCard) {

        thermalCard =
            document.createElement('div');

        thermalCard.id =
            'thermal-results-card';

        thermalCard.className =
            'card';

        document
            .querySelector('.results-panel')
            .appendChild(thermalCard);
    }


    thermalCard.innerHTML = `

        <h2>24-HOUR THERMAL SIMULATION</h2>

        <div class="result-grid">

            <div>
                <strong>Avg Indoor:</strong>
                <span>
                    ${thermalSummary.averageIndoorTemperature} °C
                </span>
            </div>

            <div>
                <strong>Minimum:</strong>
                <span>
                    ${thermalSummary.minimumIndoorTemperature} °C
                </span>
            </div>

            <div>
                <strong>Maximum:</strong>
                <span>
                    ${thermalSummary.maximumIndoorTemperature} °C
                </span>
            </div>

            <div>
                <strong>Comfort:</strong>
                <span>
                    ${thermalSummary.averageComfortScore}/100
                </span>
            </div>

            <div>
                <strong>Solar Gain:</strong>
                <span>
                    ${thermalSummary.totalSolarGain} Wh
                </span>
            </div>

            <div>
                <strong>Heat Loss:</strong>
                <span>
                    ${thermalSummary.totalHeatLoss} Wh
                </span>
            </div>

            <div>
                <strong>Heating:</strong>
                <span>
                    ${thermalSummary.heatingRequirement} kWh
                </span>
            </div>

            <div>
                <strong>Cooling:</strong>
                <span>
                    ${thermalSummary.coolingRequirement} kWh
                </span>
            </div>

        </div>

        <br>

        <canvas
            id="thermalChart"
            width="300"
            height="220">
        </canvas>

    `;


    /* ---------- 24-HOUR THERMAL GRAPH ---------- */

    const thermalCtx =
        document
            .getElementById(
                'thermalChart'
            )
            .getContext('2d');


    if (window.thermalChartInstance) {

        window.thermalChartInstance.destroy();
    }


    window.thermalChartInstance =
        new Chart(
            thermalCtx,
            {

                type: 'line',

                data: {

                    labels:
                        thermalResult.hourly.map(
                            r => `${r.hour}:00`
                        ),

                    datasets: [

                        {
                            label:
                                'Outdoor Temperature (°C)',

                            data:
                                thermalResult.hourly.map(
                                    r =>
                                        r.outdoorTemperature
                                ),

                            tension: 0.3
                        },

                        {
                            label:
                                'Indoor Temperature (°C)',

                            data:
                                thermalResult.hourly.map(
                                    r =>
                                        r.indoorTemperature
                                ),

                            tension: 0.3
                        }

                    ]
                },

                options: {

                    responsive: true,

                    scales: {

                        y: {

                            title: {

                                display: true,

                                text:
                                    'Temperature (°C)'
                            }
                        }
                    },

                    plugins: {

                        legend: {

                            display: true
                        }
                    }
                }
            }
        );

    /* ---------- COMPARISON CHART ---------- */

    document
        .getElementById(
            'comparison-card'
        )
        .classList
        .remove('hidden');


    const ctx =
        document
            .getElementById(
                'comparisonChart'
            )
            .getContext('2d');


    if (chartInstance) {
        chartInstance.destroy();
    }


    chartInstance =
        new Chart(
            ctx,
            {
                type: 'bar',

                data: {

                    labels: [
                        'Standard Design',
                        'Optimized Design'
                    ],

                    datasets: [

                        {
                            label:
                                'Comfort Score',

                            data: [
                                55,
                                score
                            ],

                            backgroundColor: [
                                '#e74c3c',
                                '#27ae60'
                            ]
                        }

                    ]
                },

                options: {

                    scales: {

                        y: {

                            beginAtZero: true,

                            max: 100
                        }
                    }
                }
            }
        );
}