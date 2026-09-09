// urbanAnalysis.js
// THERMAL SHELTER - URBAN + CLIMATE ANALYSIS


const URBAN_ANALYSIS = {

    // =========================================================
    // METRO CITY RULES
    // =========================================================

    metroCities: [

        {
            name: "Kolkata",
            aliases: ["Kolkata", "Calcutta", "West Bengal"],
            restrictedMaterials: ["Bamboo", "Mud/Adobe"]
        },

        {
            name: "Delhi",
            aliases: ["Delhi", "New Delhi"],
            restrictedMaterials: ["Bamboo", "Mud/Adobe"]
        },

        {
            name: "Mumbai",
            aliases: ["Mumbai", "Bombay", "Maharashtra"],
            restrictedMaterials: ["Bamboo", "Mud/Adobe"]
        },

        {
            name: "Bengaluru",
            aliases: ["Bengaluru", "Bangalore"],
            restrictedMaterials: ["Bamboo", "Mud/Adobe"]
        },

        {
            name: "Chennai",
            aliases: ["Chennai", "Madras"],
            restrictedMaterials: ["Bamboo", "Mud/Adobe"]
        },

        {
            name: "Hyderabad",
            aliases: ["Hyderabad"],
            restrictedMaterials: ["Bamboo", "Mud/Adobe"]
        },

        {
            name: "Pune",
            aliases: ["Pune"],
            restrictedMaterials: ["Bamboo", "Mud/Adobe"]
        },

        {
            name: "Ahmedabad",
            aliases: ["Ahmedabad"],
            restrictedMaterials: ["Bamboo", "Mud/Adobe"]
        }

    ],


    // =========================================================
    // OVERPASS SERVERS
    // =========================================================

    overpassURLs: [

        "https://overpass-api.de/api/interpreter",

        "https://overpass.kumi.systems/api/interpreter",

        "https://overpass.private.coffee/api/interpreter"

    ],


    // =========================================================
    // NASA POWER
    // =========================================================

    nasaURL:
        "https://power.larc.nasa.gov/api/temporal/climatology/point",


    // =========================================================
    // FIND METRO RULE
    // =========================================================

    getMetroRule(locationName) {

        if (!locationName) {
            return null;
        }

        const text =
            locationName.toLowerCase();

        return this.metroCities.find(city =>

            city.aliases.some(alias =>

                text.includes(
                    alias.toLowerCase()
                )

            )

        ) || null;
    },


    // =========================================================
    // GET SELECTED MATERIALS
    // =========================================================

    getSelectedMaterials() {

        const boxes =
            document.querySelectorAll(
                '#material-checkboxes input[type="checkbox"]:checked'
            );

        const names =
            Array.from(boxes).map(
                box => box.value
            );

        if (
            typeof materialDatabase ===
            "undefined"
        ) {

            return [];
        }

        return materialDatabase.filter(
            material =>
                names.includes(
                    material.name
                )
        );
    },


    // =========================================================
    // BUILDING POLYGON AREA
    // =========================================================

    polygonArea(
        points,
        centerLat,
        centerLon
    ) {

        if (
            !points ||
            points.length < 3
        ) {

            return 0;
        }


        const latFactor = 110540;

        const lonFactor =
            111320 *
            Math.cos(
                centerLat *
                Math.PI /
                180
            );


        const xy =
            points.map(point => {

                const x =
                    (point.lon - centerLon) *
                    lonFactor;

                const y =
                    (point.lat - centerLat) *
                    latFactor;

                return {
                    x,
                    y
                };

            });


        let area = 0;


        for (
            let i = 0;
            i < xy.length;
            i++
        ) {

            const j =
                (i + 1) %
                xy.length;


            area +=
                xy[i].x *
                xy[j].y -

                xy[j].x *
                xy[i].y;
        }


        return Math.abs(
            area / 2
        );
    },


    // =========================================================
    // BUILDING DENSITY FROM OPENSTREETMAP
    // =========================================================

    async getBuildingDensity(
        lat,
        lon
    ) {

        /*
            We keep the analysis radius at 100 metres.

            The query asks for building ways around
            the selected coordinate.

            If one Overpass server returns no useful
            buildings, another server is tried.
        */

        const query = `
            [out:json][timeout:30];

            way["building"](around:100,${lat},${lon});

            out geom;
        `;


        let lastError = null;


        for (
            const url of this.overpassURLs
        ) {

            try {

                console.log(
                    "Trying Overpass:",
                    url
                );


                const response =
                    await fetch(
                        url,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/x-www-form-urlencoded;charset=UTF-8"
                            },

                            body:
                                "data=" +
                                encodeURIComponent(
                                    query
                                )
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        "HTTP " +
                        response.status
                    );
                }


                const data =
                    await response.json();


                const elements =
                    data.elements || [];


                console.log(
                    "Overpass returned:",
                    elements.length,
                    "elements"
                );


                let totalBuildingArea = 0;

                let buildingCount = 0;


                // -------------------------------------------------
                // CALCULATE BUILDING AREAS
                // -------------------------------------------------

                for (
                    const element of elements
                ) {

                    if (
                        !element.geometry ||
                        element.geometry.length < 3
                    ) {

                        continue;
                    }


                    const area =
                        this.polygonArea(
                            element.geometry,
                            lat,
                            lon
                        );


                    /*
                        Ignore extremely tiny or invalid
                        polygons.
                    */

                    if (
                        Number.isFinite(area) &&
                        area > 1
                    ) {

                        totalBuildingArea +=
                            area;

                        buildingCount++;
                    }
                }


                /*
                    If the server gave us ZERO usable
                    building polygons, don't immediately
                    believe it.

                    Try the next Overpass server.
                */

                if (
                    buildingCount === 0
                ) {

                    console.warn(
                        "Overpass returned no usable building polygons."
                    );

                    lastError =
                        new Error(
                            "No building polygons returned."
                        );

                    continue;
                }


                // -------------------------------------------------
                // 100 METRE RADIUS CIRCLE
                // -------------------------------------------------

                const surroundingArea =
                    Math.PI *
                    100 *
                    100;


                let density =
                    (
                        totalBuildingArea /
                        surroundingArea
                    ) * 100;


                // Keep between 0 and 100
                density =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            density
                        )
                    );


                // -------------------------------------------------
                // CLASSIFICATION
                // -------------------------------------------------

                let classification;


                if (
                    density < 15
                ) {

                    classification =
                        "VERY LOW";

                } else if (
                    density < 30
                ) {

                    classification =
                        "LOW";

                } else if (
                    density < 50
                ) {

                    classification =
                        "MODERATE";

                } else if (
                    density < 70
                ) {

                    classification =
                        "HIGH";

                } else {

                    classification =
                        "VERY HIGH";
                }


                console.log(
                    "Building density:",
                    density,
                    "%"
                );


                return {

                    density:
                        Math.round(
                            density * 10
                        ) / 10,

                    classification,

                    buildingCount,

                    radius: 100,

                    totalBuildingArea:
                        Math.round(
                            totalBuildingArea
                        )
                };

            } catch (error) {

                console.warn(
                    "Overpass failed:",
                    url,
                    error
                );

                lastError =
                    error;
            }
        }


        /*
            All servers failed.
        */

        throw (
            lastError ||
            new Error(
                "Unable to obtain building data."
            )
        );
    },


    // =========================================================
    // NASA POWER CLIMATE DATA
    // =========================================================

    async getClimateData(
        lat,
        lon
    ) {

        const url =
            `${this.nasaURL}` +
            `?parameters=RH2M,WS10M` +
            `&community=SB` +
            `&longitude=${lon}` +
            `&latitude=${lat}` +
            `&format=JSON`;


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                "NASA POWER HTTP " +
                response.status
            );
        }


        const data =
            await response.json();


        const params =
            data.properties.parameter;


        const humidity =
            Number(
                params.RH2M.ANN
            );


        const wind =
            Number(
                params.WS10M.ANN
            );


        return {

            humidity:
                Number.isFinite(
                    humidity
                )
                    ? humidity
                    : null,

            windSpeed:
                Number.isFinite(
                    wind
                )
                    ? wind
                    : null
        };
    },


    // =========================================================
    // VENTILATION ANALYSIS
    // =========================================================

    getVentilation(
        density,
        windSpeed,
        humidity,
        temperature
    ) {

        let category =
            "MODERATE";


        let recommendation =
            "Balanced natural ventilation.";


        // -----------------------------------------------------
        // BUILDING DENSITY
        // -----------------------------------------------------

        if (
            density < 30
        ) {

            category =
                "LOW-MODERATE";


            recommendation =
                "Open surroundings provide better wind exposure. " +
                "Moderate ventilation openings are sufficient.";

        } else if (
            density < 50
        ) {

            category =
                "MODERATE";


            recommendation =
                "Use properly positioned cross-ventilation openings.";

        } else {

            category =
                "HIGH";


            recommendation =
                "Dense surroundings can obstruct airflow. " +
                "Use larger and strategically positioned " +
                "cross-ventilation openings.";
        }


        // -----------------------------------------------------
        // WIND
        // -----------------------------------------------------

        if (
            windSpeed !== null
        ) {

            if (
                windSpeed < 2
            ) {

                recommendation +=
                    " Local wind availability is relatively low, " +
                    "so cross ventilation should be emphasized.";

            } else if (
                windSpeed > 5
            ) {

                recommendation +=
                    " Higher wind availability can improve " +
                    "natural ventilation.";
            }
        }


        // -----------------------------------------------------
        // HOT + HUMID
        // -----------------------------------------------------

        if (
            humidity !== null &&
            humidity >= 70 &&
            temperature >= 25
        ) {

            recommendation +=
                " Because the climate is hot and humid, " +
                "ventilation should help remove moisture " +
                "while maintaining rain protection.";
        }


        return {

            category,

            recommendation
        };
    },


    // =========================================================
    // MATERIAL RESTRICTIONS
    // =========================================================

    getRestrictedMaterials(
        locationName
    ) {

        const restrictions = [];


        /*
            IMPORTANT:

            Only metro-city rules restrict
            Bamboo and Mud/Adobe.

            Building density itself does NOT
            ban these materials.

            This means rural areas can still
            use Bamboo/Mud.
        */

        const metro =
            this.getMetroRule(
                locationName
            );


        if (metro) {

            restrictions.push(
                ...metro.restrictedMaterials
            );
        }


        return [
            ...new Set(
                restrictions
            )
        ];
    },


    // =========================================================
    // CHOOSE WALL MATERIAL
    // =========================================================

    chooseWallMaterial(
        availableMaterials,
        restrictedMaterials,
        temperature,
        humidity
    ) {

        const candidates =
            availableMaterials.filter(
                material =>
                    !restrictedMaterials.includes(
                        material.name
                    )
            );


        if (
            candidates.length === 0
        ) {

            return null;
        }


        let best = null;

        let bestScore =
            -Infinity;


        for (
            const material of candidates
        ) {

            let score = 0;


            const k =
                Number(
                    material.thermalConductivity
                ) || 1;


            // Lower thermal conductivity
            // = better insulation

            score +=
                (1 / k) * 10;


            // -------------------------------------------------
            // HOT CLIMATE
            // -------------------------------------------------

            if (
                temperature >= 30
            ) {

                if (
                    material.thermalMass ===
                    "High"
                ) {

                    score += 12;
                }


                if (
                    material.thermalMass ===
                    "Very High"
                ) {

                    score += 15;
                }
            }


            // -------------------------------------------------
            // HUMIDITY
            // -------------------------------------------------

            if (
                humidity >= 70
            ) {

                if (
                    material.moistureResist ===
                    "High"
                ) {

                    score += 15;

                } else if (
                    material.moistureResist ===
                    "Moderate"
                ) {

                    score += 5;

                } else {

                    score -= 15;
                }
            }


            // Cost matters but does not dominate

            score -=
                (
                    Number(
                        material.defaultCost
                    ) || 1
                ) * 2;


            if (
                score > bestScore
            ) {

                bestScore =
                    score;

                best =
                    material;
            }
        }


        return best;
    },


    // =========================================================
    // CHOOSE ROOF MATERIAL
    // =========================================================

    chooseRoofMaterial(
        availableMaterials,
        restrictedMaterials,
        temperature,
        humidity
    ) {

        const candidates =
            availableMaterials.filter(
                material =>
                    !restrictedMaterials.includes(
                        material.name
                    )
            );


        if (
            candidates.length === 0
        ) {

            return null;
        }


        let best = null;

        let bestScore =
            -Infinity;


        for (
            const material of candidates
        ) {

            let score = 0;


            const k =
                Number(
                    material.thermalConductivity
                ) || 1;


            // Roof insulation is very important

            score +=
                (1 / k) * 20;


            // Hot climate

            if (
                temperature >= 30 &&
                material.name ===
                "Insulated Panel"
            ) {

                score += 30;
            }


            // Humid climate

            if (
                humidity >= 70 &&
   material.moistureResist ===
                "High"
            ) {

                score += 15;
            }


            // Cost

            score -=
                (
                    Number(
                        material.defaultCost
                    ) || 1
                ) * 2;


            if (
                score > bestScore
            ) {

                bestScore =
                    score;

                best =
                    material;
            }
        }


        return best;
    },


    // =========================================================
    // WALL THICKNESS
    // =========================================================

    calculateWallThickness(
        temperature
    ) {

        let thickness;


        /*
            Prototype design rule.

            This is NOT a structural
            engineering calculation.
        */


        if (
            temperature >= 35
        ) {

            thickness = 178;

        } else if (
            temperature >= 30
        ) {

            thickness = 178;

        } else if (
            temperature >= 25
        ) {

            thickness = 200;

        } else if (
            temperature >= 18
        ) {

            thickness = 225;

        } else if (
            temperature >= 10
        ) {

            thickness = 275;

        } else {

            thickness = 300;
        }


        // Minimum = 178 mm ≈ 7 inches

        thickness =
            Math.max(
                178,
                thickness
            );


        return thickness;
    },


    // =========================================================
    // ESTIMATE INDOOR TEMPERATURE
    // =========================================================

    estimateIndoorTemperature(
        outdoorTemp,
        humidity,
        density,
        ventilation,
        wallMaterial,
        roofMaterial,
        wallThickness
    ) {

        let change = 0;


        const wallK =
            wallMaterial
                ? Number(
                    wallMaterial.thermalConductivity
                )
                : 1;


        const roofK =
            roofMaterial
                ? Number(
                    roofMaterial.thermalConductivity
                )
                : 1;


        // -----------------------------------------------------
        // HOT CLIMATE
        // -----------------------------------------------------

        if (
            outdoorTemp >= 25
        ) {

            if (
                wallK <= 0.4
            ) {

                change -= 1.5;

            } else if (
                wallK <= 0.8
            ) {

                change -= 0.8;
            }


            if (
                wallThickness >= 225
            ) {

                change -= 0.5;
            }


            if (
                roofK <= 0.1
            ) {

                change -= 2.0;

            } else if (
                roofK <= 0.3
            ) {

                change -= 1.0;
            }


            // Passive shading

            change -= 0.8;


            // Ventilation

            if (
                (
                    ventilation ===
                    "HIGH" ||

                    ventilation ===
                    "MODERATE"
                ) &&
                humidity < 70
            ) {

                change -= 1.0;
            }


            // Dense urban surroundings

            if (
                density >= 50
            ) {

                change += 0.5;
            }
        }


        // -----------------------------------------------------
        // COLD CLIMATE
        // -----------------------------------------------------

        if (
            outdoorTemp < 18
        ) {

            if (
                wallK <= 0.4
            ) {

                change += 2.0;

            } else if (
                wallK <= 0.8
            ) {

                change += 1.0;
            }


            if (
                wallThickness >= 275
            ) {

                change += 1.5;
            }


            if (
                roofK <= 0.1
            ) {

                change += 1.5;
            }
        }


        // -----------------------------------------------------
        // HOT + HUMID PENALTY
        // -----------------------------------------------------

        if (
            outdoorTemp >= 28 &&
            humidity >= 70
        ) {

            change += 0.8;
        }


        const estimated =
            outdoorTemp +
            change;


        const low =
            Math.round(
                (estimated - 1) * 10
            ) / 10;


        const high =
            Math.round(
                (estimated + 1) * 10
            ) / 10;


        return {

            low,

            high,

            midpoint:
                Math.round(
                    estimated * 10
                ) / 10
        };
    }

};


// =============================================================
// ANALYSIS STATE
// =============================================================

let urbanAnalysisState = {

    climate: null,

    density: null,

    ventilation: null,

    ready: false,

    loading: false

};


// =============================================================
// WRAP ORIGINAL selectLocation()
// =============================================================

const originalSelectLocation =
    window.selectLocation;


window.selectLocation =
    function(lat, lon) {

        /*
            First let app.js do its normal work.
        */

        originalSelectLocation(
            lat,
            lon
        );


        urbanAnalysisState.ready =
            false;

        urbanAnalysisState.loading =
            true;

        urbanAnalysisState.climate =
            null;

        urbanAnalysisState.density =
            null;

        urbanAnalysisState.ventilation =
            null;


        // -----------------------------------------------------
        // SHOW LOADING STATE
        // -----------------------------------------------------

        const windInput =
            document.getElementById(
                "wind-input"
            );


        if (windInput) {

            windInput.value =
                "Loading...";
        }


        const densityInput =
            document.getElementById(
                "density-input"
            );


        if (densityInput) {

            densityInput.value =
                "Loading...";
        }


        const climateDisplay =
            document.getElementById(
                "climate-class-display"
            );


        if (climateDisplay) {

            climateDisplay.innerText =
                "Loading climate + surroundings... <br> <font size=0.5em>this might take upto 3 minuites, please be patient</font>";
        }


        analyzeLocation(
            lat,
            lon
        );
    };


// =============================================================
// ANALYZE LOCATION
// =============================================================

async function analyzeLocation(
    lat,
    lon
) {

    try {

        const results =
            await Promise.allSettled([

                // NASA
                URBAN_ANALYSIS.getClimateData(
                    lat,
                    lon
                ),

                // OSM
                URBAN_ANALYSIS.getBuildingDensity(
                    lat,
                    lon
                )

            ]);


        // =====================================================
        // NASA RESULT
        // =====================================================

        if (
            results[0].status ===
            "fulfilled"
        ) {

            urbanAnalysisState.climate =
                results[0].value;


            // Update currentSelection
            if (
                typeof currentSelection !==
                "undefined"
            ) {

                currentSelection.humidity =
                    urbanAnalysisState
                        .climate
                        .humidity;
            }


            const humidityInput =
                document.getElementById(
                    "hum-input"
                );


            if (humidityInput) {

                humidityInput.value =

                    urbanAnalysisState
                        .climate
                        .humidity !== null

                        ? urbanAnalysisState
                            .climate
                            .humidity
                            .toFixed(2)

                        : "Unavailable";
            }


            // Wind

            const windInput =
                document.getElementById(
                    "wind-input"
                );


            if (windInput) {

                if (
                    urbanAnalysisState
                        .climate
                        .windSpeed !== null
                ) {

                    windInput.value =
                        urbanAnalysisState
                            .climate
                            .windSpeed
                            .toFixed(1) +
                        " m/s";

                } else {

                    windInput.value =
                        "Unavailable";
                }
            }

        } else {

            console.warn(
                "NASA POWER failed:",
                results[0].reason
            );


            const windInput =
                document.getElementById(
                    "wind-input"
                );


            if (windInput) {

                windInput.value =
                    "Unavailable";
            }
        }


        // =====================================================
        // OSM RESULT
        // =====================================================

        if (
            results[1].status ===
            "fulfilled"
        ) {

            urbanAnalysisState.density =
                results[1].value;


            const densityInput =
                document.getElementById(
                    "density-input"
                );


            if (densityInput) {

                densityInput.value =
                    urbanAnalysisState
                        .density
                        .density
                        .toFixed(1) +
                    "% (" +
                    urbanAnalysisState
                        .density
                        .classification +
                    ")";
            }

        } else {

            console.warn(
                "OSM building density failed:",
                results[1].reason
            );


            const densityInput =
                document.getElementById(
                    "density-input"
                );


            if (densityInput) {

                densityInput.value =
                    "Unavailable";
            }
        }


        // =====================================================
        // CLIMATE CLASS
        // =====================================================

        const tempInput =
            document.getElementById(
                "temp-input"
            );


        const temperature =
            tempInput
                ? parseFloat(
                    tempInput.value
                )
                : null;


        if (
            urbanAnalysisState.climate &&
            Number.isFinite(
                temperature
            )
        ) {

            const humidity =
                urbanAnalysisState
                    .climate
                    .humidity;


            let climateClass;


            if (
                temperature < 15
            ) {

                climateClass =
                    "COLD";

            } else if (
                temperature > 25
            ) {

                climateClass =
                    "HOT";

            } else {

                climateClass =
                    "MODERATE";
            }


            const climateDisplay =
                document.getElementById(
                    "climate-class-display"
                );


            if (climateDisplay) {

                climateDisplay.innerText =
                    `Climate: ${climateClass} | RH: ${
                        humidity !== null
                            ? Math.round(
                                humidity
                            )
                            : "--"
                    }%`;
            }


            // =================================================
            // VENTILATION
            // =================================================

            const density =
                urbanAnalysisState.density
                    ? urbanAnalysisState
                        .density
                        .density
                    : 30;


            urbanAnalysisState.ventilation =
                URBAN_ANALYSIS.getVentilation(

                    density,

                    urbanAnalysisState
                        .climate
                        .windSpeed,

                    humidity,

                    temperature
                );


            urbanAnalysisState.ready =
                true;
        }

    } catch (error) {

        console.error(
            "Location analysis failed:",
            error
        );

    } finally {

        urbanAnalysisState.loading =
            false;
    }
}


// =============================================================
// WRAP ORIGINAL runOptimization()
// =============================================================

const originalRunOptimization =
    window.runOptimization;


window.runOptimization =
    async function() {

        const tempInput =
            document.getElementById(
                "temp-input"
            );


        if (
            !tempInput ||
            !tempInput.value
        ) {

            alert(
                "Select a location first."
            );

            return;
        }


        if (
            urbanAnalysisState.loading
        ) {

            alert(
                "Still analysing the selected location. " +
                "Please wait a few seconds."
            );

            return;
        }


        const temperature =
            parseFloat(
                tempInput.value
            );


        const humidity =
            urbanAnalysisState.climate
                ? urbanAnalysisState
                    .climate
                    .humidity

                : parseFloat(
                    document.getElementById(
                        "hum-input"
                    ).value
                ) || 50;


        const density =
            urbanAnalysisState.density
                ? urbanAnalysisState
                    .density
                    .density

                : 30;


        // =====================================================
        // GET SELECTED LOCATION NAME
        // =====================================================

        const locationName =
            document.getElementById(
                "demo-location-select"
            )
                ?.selectedOptions?.[0]
                ?.innerText || "";


        // =====================================================
        // GET MATERIALS
        // =====================================================

        const availableMaterials =
            URBAN_ANALYSIS
                .getSelectedMaterials();


        if (
            availableMaterials.length === 0
        ) {

            alert(
                "Select at least one available material."
            );

            return;
        }


        // =====================================================
        // MATERIAL RESTRICTIONS
        // =====================================================

        const restrictedMaterials =
            URBAN_ANALYSIS
                .getRestrictedMaterials(
                    locationName
                );


        // =====================================================
        // WALL
        // =====================================================

        const wallMaterial =
            URBAN_ANALYSIS
                .chooseWallMaterial(

                    availableMaterials,

                    restrictedMaterials,

                    temperature,

                    humidity
                );


        // =====================================================
        // ROOF
        // =====================================================

        const roofMaterial =
            URBAN_ANALYSIS
                .chooseRoofMaterial(

                    availableMaterials,

                    restrictedMaterials,

                    temperature,

                    humidity
                );


        if (
            !wallMaterial
        ) {

            alert(
                "None of the selected materials " +
                "are suitable for this location."
            );

            return;
        }


        // =====================================================
        // WALL THICKNESS
        // =====================================================

        const wallThickness =
            URBAN_ANALYSIS
                .calculateWallThickness(
                    temperature
                );


        // =====================================================
        // VENTILATION
        // =====================================================

        const ventilation =
            urbanAnalysisState
                .ventilation ||

            URBAN_ANALYSIS.getVentilation(

                density,

                urbanAnalysisState.climate
                    ? urbanAnalysisState
                        .climate
                        .windSpeed

                    : null,

                humidity,

                temperature
            );


        // =====================================================
        // ESTIMATED INDOOR TEMPERATURE
        // =====================================================

        const indoor =
            URBAN_ANALYSIS
                .estimateIndoorTemperature(

                    temperature,

                    humidity,

                    density,

                    ventilation.category,

                    wallMaterial,

                    roofMaterial,

                    wallThickness
                );


        // =====================================================
        // RUN ORIGINAL OPTIMIZER
        // =====================================================

        originalRunOptimization();


        // =====================================================
        // OVERRIDE WALL RESULT
        // =====================================================

        const wallElement =
            document.getElementById(
                "res-wall"
            );


        if (wallElement) {

            wallElement.innerText =
                `${wallMaterial.name} ` +
                `(${wallThickness} mm / ` +
                `${(
                    wallThickness /
                    25.4
                ).toFixed(1)} in)`;
        }


        // =====================================================
        // OVERRIDE ROOF RESULT
        // =====================================================

        const roofElement =
            document.getElementById(
                "res-roof"
            );


        if (roofElement) {

            roofElement.innerText =
                roofMaterial
                    ? roofMaterial.name
                    : "Not determined";
        }


        // =====================================================
        // OPTIONAL RESULT ELEMENTS
        // =====================================================

        const conditionElement =
            document.getElementById(
  "res-condition"
            );


        if (conditionElement) {

            const condition =
                temperature >= 30
                    ? "Hot"

                    : temperature >= 18
                        ? "Moderate"

                        : "Cold";


            conditionElement.innerText =
                `${condition} | ` +
                `${humidity.toFixed(0)}% RH`;
        }


        const ventilationElement =
            document.getElementById(
                "res-ventilation"
            );


        if (ventilationElement) {

            ventilationElement.innerText =
                ventilation.recommendation;
        }


        const shadingElement =
            document.getElementById(
                "res-shading"
            );


        if (shadingElement) {

            shadingElement.innerText =
                temperature >= 30
                    ? "High external shading"
                    : "Moderate shading";
        }


        const moistureElement =
            document.getElementById(
                "res-moisture"
            );


        if (moistureElement) {

            moistureElement.innerText =
                humidity >= 70
                    ? "High moisture protection"
                    : "Standard moisture protection";
        }


        // =====================================================
        // DESIGN RESULTS ONLY
        // =====================================================

        addDesignResult(
            "res-wall-thickness",
            "Recommended Wall",
            `${wallThickness} mm (${(
                wallThickness /
                25.4
            ).toFixed(1)} in)`
        );


        addDesignResult(
            "res-indoor",
            "Estimated Passive Indoor Temp.",
            `${indoor.low}–${indoor.high} °C`
        );


        addDesignResult(
            "res-material-rule",
            "Material Rule",
            restrictedMaterials.length > 0

                ? `Restricted: ${
                    restrictedMaterials.join(
                        ", "
                    )
                }`

                : "No special restriction"
        );


        addDesignResult(
            "res-ventilation",
            "Ventilation",
            ventilation.category
        );
    };


// =============================================================
// ADD DESIGN RESULT
// =============================================================

function addDesignResult(
    id,
    label,
    value
) {

    let element =
        document.getElementById(
            id
        );


    // If element already exists,
    // simply update it.

    if (element) {

        element.innerText =
            value;

        return;
    }


    const resultGrid =
        document.querySelector(
            "#recommendation-card .result-grid"
        );


    if (!resultGrid) {

        return;
    }


    const div =
        document.createElement(
            "div"
        );


    div.id =
        id;


    div.innerHTML =
        `<strong>${label}:</strong> ` +
        `<span></span>`;


    div.querySelector(
        "span"
    ).innerText =
        value;


    resultGrid.appendChild(
        div
    );
}
// ============================================================
// LOCATION INPUT
// PIN CODE HAS PRIORITY OVER LATITUDE/LONGITUDE
// ============================================================

async function findLocation() {

    const pin = document.getElementById("pincode-input").value.trim();

    const latInput = document.getElementById("manual-lat-input").value.trim();
const lonInput = document.getElementById("manual-lon-input").value.trim();

    // --------------------------------------------------------
    // OPTION 1: PIN CODE
    // PIN ALWAYS HAS PRIORITY
    // --------------------------------------------------------

    if (pin !== "") {

        // Validate PIN
        if (!/^\d{6}$/.test(pin)) {
            alert("Please enter a valid 6-digit Indian PIN code.");
            return;
        }

        try {

            const url =
                "https://nominatim.openstreetmap.org/search" +
                "?q=" + encodeURIComponent(pin + ", India") +
                "&format=json" +
                "&limit=1";

            const response = await fetch(url, {
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("Location service unavailable.");
            }

            const data = await response.json();

            if (!data || data.length === 0) {
                alert("Could not find this PIN code.");
                return;
            }

            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);

            if (isNaN(lat) || isNaN(lon)) {
                alert("Invalid coordinates returned for this PIN code.");
                return;
            }

            // PIN IS THE SOURCE OF TRUTH
            document.getElementById("lat-input").value = lat.toFixed(6);
            document.getElementById("lon-input").value = lon.toFixed(6);

            // Use the normal location-analysis system
            selectLocation(lat, lon);

            console.log(
                "Location selected using PIN:",
                pin,
                lat,
                lon
            );

            return;

        } catch (error) {

            console.error("PIN lookup error:", error);

            alert(
                "Could not find this PIN code.\n" +
                "Please try another PIN or use latitude and longitude."
            );

            return;
        }
    }

    // --------------------------------------------------------
    // OPTION 2: LATITUDE + LONGITUDE
    // Only used when PIN IS EMPTY
    // --------------------------------------------------------

    if (latInput !== "" && lonInput !== "") {

        const lat = parseFloat(latInput);
        const lon = parseFloat(lonInput);

        if (isNaN(lat) || isNaN(lon)) {
            alert("Please enter valid latitude and longitude.");
            return;
        }

        // India boundary check
        if (
            lat < 6 ||
            lat > 38 ||
            lon < 67 ||
            lon > 98
        ) {
            alert("Please enter coordinates within India.");
            return;
        }

        selectLocation(lat, lon);

        console.log(
            "Location selected using coordinates:",
            lat,
            lon
        );

        return;
    }

    // --------------------------------------------------------
    // NOTHING ENTERED
    // --------------------------------------------------------

    alert(
        "Please enter either a PIN code or both latitude and longitude."
    );
}