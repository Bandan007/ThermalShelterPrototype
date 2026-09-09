/*
 * Thermal Shelter Design System
 * Simplified 24-hour thermal simulation
 *
 * Prototype engineering model — NOT CFD.
 */

function createHourlyClimate(climate) {

    const baseTemp = Number(climate.temperature) || 25;

    // Solar radiation must be a realistic peak value.
    // Expected range: roughly 100–1100 W/m².
    const solarPeak = Math.max(
        100,
        Math.min(
            1100,
            Number(climate.solarRadiation) || 500
        )
    );

    const wind = Math.max(
        0.2,
        Number(climate.windSpeed) || 1
    );

    const hourly = [];

    for (let hour = 0; hour < 24; hour++) {

        const outdoorTemperature =
            baseTemp +
            6 *
            Math.sin(
                (2 * Math.PI * (hour - 9)) / 24
            );

        let solar = 0;

        if (hour >= 6 && hour <= 18) {

            solar =
                solarPeak *
                Math.sin(
                    (Math.PI * (hour - 6)) / 12
                );
        }

        hourly.push({
            hour: hour,
            outdoorTemperature: outdoorTemperature,
            solarRadiation: Math.max(0, solar),
            windSpeed: wind
        });
    }

    return hourly;
}


function calculateShelterGeometry(design) {

    const floorArea =
        Math.max(
            1,
            Number(design.floorArea) || 20
        );

    const height =
        Math.max(
            2,
            Number(design.height) || 3
        );

    const side = Math.sqrt(floorArea);

    const perimeter = 4 * side;

    const grossWallArea =
        perimeter * height;

    const windowArea =
        Math.min(
            Math.max(
                0,
                Number(design.windowArea) || 0
            ),
            grossWallArea * 0.25
        );

    return {

        floorArea,

        height,

        volume:
            floorArea * height,

        roofArea:
            floorArea,

        grossWallArea,

        wallArea:
            Math.max(
                1,
                grossWallArea - windowArea
            ),

        windowArea
    };
}


function simulateThermalPerformance(
    design,
    climate
) {

    const geometry =
        calculateShelterGeometry(design);

    const hourlyClimate =
        createHourlyClimate(climate);


    const wallK =
        Math.max(
            0.03,
            Number(design.wallConductivity) || 0.7
        );

    const roofK =
        Math.max(
            0.02,
            Number(design.roofConductivity) || 0.03
        );

    const wallThickness =
        Math.max(
            0.05,
            Number(design.wallThickness) || 0.2
        );

    const roofThickness =
        Math.max(
            0.05,
            Number(design.roofThickness) || 0.15
        );

    const windowU =
        Math.max(
            0.5,
            Number(design.windowU) || 2.8
        );


    const wallU =
        wallK / wallThickness;

    const roofU =
        roofK / roofThickness;


    const wallConductance =
        wallU * geometry.wallArea;

    const roofConductance =
        roofU * geometry.roofArea;

    const windowConductance =
        windowU * geometry.windowArea;


    // IMPORTANT:
    // Combine all envelope heat-transfer paths.
    const envelopeConductance =
        wallConductance +
        roofConductance +
        windowConductance;


    const openingRatio =
        Math.max(
            0,
            Math.min(
                0.30,
                Number(design.openingRatio) || 0.10
            )
        );


    const wind =
        Math.max(
            0.2,
            Number(climate.windSpeed) || 1
        );


    const ach =
        0.35 +
        openingRatio * 4 +
        Math.min(wind, 8) * 0.12;


    const airHeatCapacity =
        1.2 *
        1005 *
        geometry.volume;


    const ventilationConductance =
        (airHeatCapacity * ach) / 3600;


    const thermalMass =
        Math.max(
            airHeatCapacity,
            Number(design.thermalMass) || 600000
        );


    const solarGainFactor =
        Math.max(
            0,
            Math.min(
                0.8,
                Number(design.solarGainFactor) || 0.5
            )
        );


    const roofSolarAbsorption =
        0.08;


    const windowSolarGainFactor =
        Math.min(
            0.65,
            solarGainFactor
        );


    let indoorTemperature =
        hourlyClimate[0].outdoorTemperature;


    const results = [];


    let totalSolarGainWh = 0;

    let totalHeatLossWh = 0;

    let heatingWh = 0;

    let coolingWh = 0;

    let comfortSum = 0;


    for (const weather of hourlyClimate) {

        const outdoor =
            weather.outdoorTemperature;

        const solar =
            weather.solarRadiation;


        const conductionW =
            envelopeConductance *
            (outdoor - indoorTemperature);


        const ventilationW =
            ventilationConductance *
            (outdoor - indoorTemperature);


        const solarWindowW =
            solar *
            geometry.windowArea *
            windowSolarGainFactor;


        const solarRoofW =
            solar *
            geometry.roofArea *
            roofSolarAbsorption;


        const solarGainW =
            solarWindowW +
            solarRoofW;


        const netHeatW =
            conductionW +
            ventilationW +
            solarGainW;


        const energyJ =
            netHeatW * 3600;


        const deltaT =
            energyJ /
            thermalMass;


        indoorTemperature +=
            deltaT;


        const comfortTarget = 24;


        let conditioningWh = 0;


        if (
            indoorTemperature <
            comfortTarget
        ) {

            conditioningWh =
                (
                    (comfortTarget -
                        indoorTemperature) *
                    thermalMass
                ) / 3600;


            heatingWh +=
                Math.max(
                    0,
                    conditioningWh
                );

        }


        else if (
            indoorTemperature >
            comfortTarget
        ) {

            conditioningWh =
                (
                    (indoorTemperature -
                        comfortTarget) *
                    thermalMass
                ) / 3600;


            coolingWh +=
                Math.max(
                    0,
                    conditioningWh
                );
        }


        const heatLossW =
            Math.max(
                0,
                -(
                    conductionW +
                    ventilationW
                )
            );


        totalHeatLossWh +=
            heatLossW;


        totalSolarGainWh +=
            solarGainW;


        const temperatureDeviation =
            Math.abs(
                indoorTemperature -
                comfortTarget
            );


        const comfort =
            Math.max(
                0,
                100 -
                temperatureDeviation * 8
            );


        comfortSum +=
            comfort;


        results.push({

            hour:
                weather.hour,

            outdoorTemperature:
                Number(
                    outdoor.toFixed(2)
                ),

            indoorTemperature:
                Number(
                    indoorTemperature.toFixed(2)
                ),

            solarRadiation:
                Number(
                    solar.toFixed(2)
                ),

            solarGain:
                Number(
                    solarGainW.toFixed(2)
                ),

            conductionHeatFlow:
                Number(
                    conductionW.toFixed(2)
                ),

            ventilationHeatFlow:
                Number(
                    ventilationW.toFixed(2)
                ),

            heatLoss:
                Number(
                    heatLossW.toFixed(2)
                ),

            comfort:
                Number(
                    comfort.toFixed(1)
                )
        });
    }


    const indoorTemps =
        results.map(
            r => r.indoorTemperature
        );


    const averageIndoor =
        indoorTemps.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        indoorTemps.length;


    return {

        geometry,

        hourly: results,

        summary: {

            averageIndoorTemperature:
                Number(
                    averageIndoor.toFixed(2)
                ),

            minimumIndoorTemperature:
                Number(
                    Math.min(
                        ...indoorTemps
                    ).toFixed(2)
                ),

            maximumIndoorTemperature:
                Number(
                    Math.max(
                        ...indoorTemps
                    ).toFixed(2)
                ),

            averageComfortScore:
                Math.round(
                    comfortSum /
                    results.length
                ),

            totalSolarGain:
                Number(
                    totalSolarGainWh.toFixed(2)
                ),

            totalHeatLoss:
                Number(
                    totalHeatLossWh.toFixed(2)
                ),

            heatingRequirement:
                Number(
                    (
                        heatingWh / 1000
                    ).toFixed(3)
                ),

            coolingRequirement:
                Number(
                    (
                        coolingWh / 1000
                    ).toFixed(3)
                )
        }
    };
}


function calculateThermalPerformance(
    design,
    climate
) {

    return simulateThermalPerformance(
        design,
        climate
    );
}