/*
=========================================================
 THERMAL SHELTER MODEL - VERSION 2
 24-HOUR DYNAMIC THERMAL SIMULATION

 Calculates:
 - Solar heat gain
 - Wall conduction
 - Roof conduction
 - Window conduction
 - Ventilation heat exchange
 - Thermal mass effect
 - Indoor temperature hour by hour
 - Heating / cooling requirement
 - Comfort score

 This is a simplified physics-based prototype model.
=========================================================
*/


// -------------------------------------------------------
// 1. CREATE A 24-HOUR CLIMATE PROFILE
// -------------------------------------------------------

function createHourlyClimate(climate) {

    const baseTemp = Number(climate.temperature) || 25;
    const humidity = Number(climate.humidity) || 50;
    const windSpeed = Number(climate.windSpeed) || 1;
    const baseSolar = Number(climate.solarRadiation) || 500;

    const profile = [];

    /*
        Approximate daily temperature variation.

        Cold climates get a slightly larger swing.
        This is a prototype when actual hourly weather
        data is not available.
    */

    let tempAmplitude;

    if (baseTemp < 15) {
        tempAmplitude = 7;
    } else if (baseTemp > 30) {
        tempAmplitude = 5;
    } else {
        tempAmplitude = 4;
    }


    for (let hour = 0; hour < 24; hour++) {

        // Temperature minimum around early morning.
        const tempWave =
            Math.sin((hour - 8) * Math.PI / 12);

        const outdoorTemp =
            baseTemp + tempAmplitude * tempWave;


        // Solar radiation.
        let solar = 0;

        if (hour >= 6 && hour <= 18) {

            const solarAngle =
                Math.PI * (hour - 6) / 12;

            solar =
                Math.max(0, Math.sin(solarAngle)) *
                baseSolar * 2.0;
        }


        // Small natural wind variation.
        const hourlyWind =
            Math.max(
                0.2,
                windSpeed *
                (0.8 + 0.2 *
                Math.sin((hour + 2) * Math.PI / 12))
            );


        profile.push({
            hour: hour,
            temperature: outdoorTemp,
            humidity: humidity,
            windSpeed: hourlyWind,
            solarRadiation: solar
        });
    }

    return profile;
}



// -------------------------------------------------------
// 2. CALCULATE SHELTER GEOMETRY
// -------------------------------------------------------

function calculateShelterGeometry(design) {

    const floorArea =
        Number(design.floorArea) || 20;

    const height =
        Number(design.height) || 3;

    const width =
        Math.sqrt(floorArea);

    const length =
        floorArea / width;

    const wallArea =
        2 * (width + length) * height;

    const roofArea =
        floorArea;

    const volume =
        floorArea * height;

    return {
        width,
        length,
        height,
        floorArea,
        wallArea,
        roofArea,
        volume
    };
}



// -------------------------------------------------------
// 3. MAIN THERMAL SIMULATION
// -------------------------------------------------------

function simulateThermalPerformance(design, climate) {

    const geometry =
        calculateShelterGeometry(design);

    const hourlyClimate =
        createHourlyClimate(climate);


    // ---------------------------------------------------
    // MATERIAL / CONSTRUCTION PROPERTIES
    // ---------------------------------------------------

    const wallK =
        Number(design.wallConductivity) || 0.7;

    const roofK =
        Number(design.roofConductivity) || 0.03;

    const wallThickness =
        Number(design.wallThickness) || 0.20;

    const roofThickness =
        Number(design.roofThickness) || 0.15;


    // ---------------------------------------------------
    // OPENINGS
    // ---------------------------------------------------

    const windowArea =
        Number(design.windowArea) ||
        geometry.floorArea * 0.10;

    const openingRatio =
        Number(design.openingRatio) || 0.10;

    const openingArea =
        geometry.floorArea *
        openingRatio;


    // ---------------------------------------------------
    // WINDOW PROPERTIES
    // ---------------------------------------------------

    const windowU =
        Number(design.windowU) || 2.8;

    const solarGainFactor =
        Number(design.solarGainFactor) || 0.55;


    // ---------------------------------------------------
    // THERMAL MASS
    // ---------------------------------------------------

    /*
        Thermal capacitance = J/K

        A larger value means the shelter changes
        temperature more slowly.
    */

    const thermalMass =
        Number(design.thermalMass) || 500000;


    // ---------------------------------------------------
    // AIR PROPERTIES
    // ---------------------------------------------------

    const airDensity = 1.2;
    const airSpecificHeat = 1005;


    // ---------------------------------------------------
    // INITIAL INDOOR TEMPERATURE
    // ---------------------------------------------------

    let indoorTemp =
        hourlyClimate[0].temperature;


    const results = [];

    let totalSolarGain = 0;
    let totalHeatLoss = 0;
    let totalHeating = 0;
    let totalCooling = 0;


    // ---------------------------------------------------
    // HOURLY SIMULATION
    // ---------------------------------------------------

    for (let hour = 0; hour < 24; hour++) {

        const weather =
            hourlyClimate[hour];

        const outdoorTemp =
            weather.temperature;

        const solar =
            weather.solarRadiation;

        const wind =
            weather.windSpeed;


        // -----------------------------------------------
        // WALL CONDUCTION
        // -----------------------------------------------

        const wallU =
            wallK / wallThickness;

        const wallHeatTransfer =
            wallU *
            geometry.wallArea *
            (indoorTemp - outdoorTemp);


        // -----------------------------------------------
        // ROOF CONDUCTION
        // -----------------------------------------------

        const roofU =
            roofK / roofThickness;

        const roofHeatTransfer =
            roofU *
            geometry.roofArea *
            (indoorTemp - outdoorTemp);


        // -----------------------------------------------
        // WINDOW CONDUCTION
        // -----------------------------------------------

        const windowHeatTransfer =
            windowU *
            windowArea *
            (indoorTemp - outdoorTemp);


        // -----------------------------------------------
        // VENTILATION
        // -----------------------------------------------

        /*
            Air changes increase with:
            - wind
            - opening size
        */

        const ACH =
            Math.max(
                0.5,
                1 +
                wind *
                openingRatio *
                4
            );

        const airMassPerHour =
            airDensity *
            geometry.volume *
            ACH;

        const ventilationHeatTransfer =
            (
                airMassPerHour *
                airSpecificHeat *
                (indoorTemp - outdoorTemp)
            ) / 3600;


        // -----------------------------------------------
        // SOLAR HEAT GAIN
        // -----------------------------------------------

        const solarGain =
            solar *
            windowArea *
            solarGainFactor;


        // -----------------------------------------------
        // TOTAL CONDUCTION + VENTILATION
        // -----------------------------------------------

        const heatLoss =
            wallHeatTransfer +
            roofHeatTransfer +
            windowHeatTransfer +
            ventilationHeatTransfer;


        // -----------------------------------------------
        // NET HEAT FLOW
        // -----------------------------------------------

        const netHeatFlow =
            solarGain -
            heatLoss;


        // -----------------------------------------------
        // TEMPERATURE CHANGE
        // -----------------------------------------------

        /*
            Q = C × ΔT

            ΔT = Q / C

            One simulation step = 1 hour.
        */

        const temperatureChange =
            (netHeatFlow * 3600) /
            thermalMass;


        indoorTemp += temperatureChange;


        // -----------------------------------------------
        // OPTIONAL ACTIVE ENERGY REQUIREMENT
        // -----------------------------------------------

        let heatingRequired = 0;
        let coolingRequired = 0;

        /*
            Comfortable target range:
            20°C - 26°C

            If passive design cannot maintain it,
            calculate approximate active energy requirement.
        */

        if (indoorTemp < 20) {

            heatingRequired =
                (
                    (20 - indoorTemp) *
                    thermalMass
                ) / 3600000;

        }

        if (indoorTemp > 26) {

            coolingRequired =
                (
                    (indoorTemp - 26) *
                    thermalMass
                ) / 3600000;
        }


        // -----------------------------------------------
        // COMFORT SCORE
        // -----------------------------------------------

        let comfort = 100;

        if (indoorTemp < 20) {

            comfort -=
                (20 - indoorTemp) * 8;

        } else if (indoorTemp > 26) {

            comfort -=
                (indoorTemp - 26) * 8;
        }


        if (
            weather.humidity < 30 ||
            weather.humidity > 70
        ) {
            comfort -= 5;
        }


        comfort =
            Math.max(
                0,
                Math.min(100, comfort)
            );


        // -----------------------------------------------
        // STORE RESULT
        // -----------------------------------------------

        results.push({

            hour: hour,

            outdoorTemperature:
                Number(outdoorTemp.toFixed(2)),

            indoorTemperature:
                Number(indoorTemp.toFixed(2)),

            solarRadiation:
                Number(solar.toFixed(2)),

            solarGain:
                Number(solarGain.toFixed(2)),

            wallHeatTransfer:
                Number(wallHeatTransfer.toFixed(2)),

            roofHeatTransfer:
                Number(roofHeatTransfer.toFixed(2)),

            windowHeatTransfer:
                Number(windowHeatTransfer.toFixed(2)),

            ventilationHeatTransfer:
                Number(ventilationHeatTransfer.toFixed(2)),

            netHeatFlow:
                Number(netHeatFlow.toFixed(2)),

            heatingRequired:
                Number(heatingRequired.toFixed(3)),

            coolingRequired:
                Number(coolingRequired.toFixed(3)),

            airChangesPerHour:
                Number(ACH.toFixed(2)),

            comfortScore:
                Math.round(comfort)
        });


        totalSolarGain += solarGain;

        totalHeatLoss +=
            Math.max(heatLoss, 0);

        totalHeating +=
            heatingRequired;

        totalCooling +=
            coolingRequired;
    }


    // ---------------------------------------------------
    // DAILY COMFORT
    // ---------------------------------------------------

    const averageComfort =
        results.reduce(
            (sum, item) =>
                sum + item.comfortScore,
            0
        ) / results.length;


    const minimumIndoorTemp =
        Math.min(
            ...results.map(
                r => r.indoorTemperature
            )
        );


    const maximumIndoorTemp =
        Math.max(
            ...results.map(
                r => r.indoorTemperature
            )
        );


    const averageIndoorTemp =
        results.reduce(
            (sum, r) =>
                sum + r.indoorTemperature,
            0
        ) / results.length;


    // ---------------------------------------------------
    // RETURN EVERYTHING
    // ---------------------------------------------------

    return {

        geometry: geometry,

        hourly: results,

        summary: {

            averageIndoorTemperature:
                Number(
                    averageIndoorTemp.toFixed(2)
                ),

            minimumIndoorTemperature:
                Number(
                    minimumIndoorTemp.toFixed(2)
                ),

            maximumIndoorTemperature:
                Number(
                    maximumIndoorTemp.toFixed(2)
                ),

            averageComfortScore:
                Math.round(
                    averageComfort
                ),

            totalSolarGain:
                Number(
                    totalSolarGain.toFixed(2)
                ),

            totalHeatLoss:
                Number(
                    totalHeatLoss.toFixed(2)
                ),

            heatingRequirement:
                Number(
                    totalHeating.toFixed(3)
                ),

            coolingRequirement:
                Number(
                    totalCooling.toFixed(3)
                )
        }
    };
}



// -------------------------------------------------------
// BACKWARD-COMPATIBLE FUNCTION
// -------------------------------------------------------

function calculateThermalPerformance(design, climate) {

    const simulation =
        simulateThermalPerformance(
            design,
            climate
        );

    return {

        indoorTemperature:
            simulation.summary
                .averageIndoorTemperature,

        comfortScore:
            simulation.summary
                .averageComfortScore,

        solarGain:
            simulation.summary
                .totalSolarGain,

        totalHeatLoss:
            simulation.summary
                .totalHeatLoss,

        heatingRequirement:
            simulation.summary
                .heatingRequirement,

        coolingRequirement:
            simulation.summary
                .coolingRequirement,

        hourly:
            simulation.hourly
    };
}