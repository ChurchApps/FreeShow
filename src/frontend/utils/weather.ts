import type { Weather } from "../../types/Show"

// https://api.met.no/weatherapi/locationforecast/2.0/documentation
// https://api.met.no/doc/ForecastJSON
const metAPI = "https://api.met.no/weatherapi/locationforecast/2.0/complete?"

type TmetAPI = {
    type: "Feature"
    geometry: {
        type: "Point"
        coordinates: [number, number, number]
    }
    properties: {
        meta: {
            updated_at: string
            units: {
                air_pressure_at_sea_level: string // "hPa"
                air_temperature: string // "celsius"
                air_temperature_max: string // "celsius"
                air_temperature_min: string // "celsius"
                cloud_area_fraction: string // "%"
                cloud_area_fraction_high: string // "%"
                cloud_area_fraction_low: string // "%"
                cloud_area_fraction_medium: string // "%"
                dew_point_temperature: string // "celsius"
                fog_area_fraction: string // "%"
                precipitation_amount: string // "mm"
                precipitation_amount_max: string // "mm"
                precipitation_amount_min: string // "mm"
                probability_of_precipitation: string // "%"
                probability_of_thunder: string // "%"
                relative_humidity: string // "%"
                ultraviolet_index_clear_sky: string // "1"
                wind_from_direction: string // "degrees"
                wind_speed: string // "m/s"
                wind_speed_of_gust: string // "m/s
            }
        }
        timeseries: {
            time: string
            data: {
                instant: {
                    details: DetailsInstant
                }
                next_1_hours?: {
                    summary: Summary
                    details: Details
                }
                next_6_hours?: {
                    summary: Summary
                    details: Details
                }
                next_12_hours?: {
                    summary: Summary
                    details: Details
                }
            }
        }[]
    }
}

interface DetailsInstant {
    air_pressure_at_sea_level?: number
    air_temperature?: number
    cloud_area_fraction?: number
    cloud_area_fraction_high?: number
    cloud_area_fraction_low?: number
    cloud_area_fraction_medium?: number
    dew_point_temperature?: number
    fog_area_fraction?: number
    relative_humidity?: number
    ultraviolet_index_clear_sky?: number
    wind_from_direction?: number
    wind_speed?: number
    wind_speed_of_gust?: number
}
interface Details extends DetailsInstant {
    air_temperature_max?: number
    air_temperature_min?: number
    precipitation_amount?: number
    precipitation_amount_max?: number
    precipitation_amount_min?: number
    probability_of_precipitation?: number
    probability_of_thunder?: number
}
type Summary = {
    symbol_code: string
}

const cachedWeatherData: { [key: string]: { time: number; data: TmetAPI } } = {}
export async function getWeather(data: Weather): Promise<TmetAPI | null> {
    const latitude = data.latitude || 0
    const longitude = data.longitude || 0
    const altitude = data.altitude || 0

    if (latitude === 0 && longitude === 0) return null

    const queryValues: { [key: string]: number | string } = {
        lat: latitude,
        lon: longitude
    }

    if (altitude) queryValues.altitude = altitude

    const queryArray = Object.entries(queryValues).map(([key, value]) => `${key}=${value}`)
    const queryKey = JSON.stringify(data)

    // don't use cache if it's older than one hour
    const ONE_HOUR = 3600000
    if (cachedWeatherData[queryKey] && Date.now() - cachedWeatherData[queryKey].time < ONE_HOUR) {
        return cachedWeatherData[queryKey].data
    }

    const query = metAPI + queryArray.join("&")

    return new Promise((resolve: (value: TmetAPI | null) => void) => {
        fetch(query)
            .then(response => {
                if (!response.ok) {
                    console.error(`HTTP error: ${response.status}`)
                    resolve(null)
                    return
                }

                return response.json()
            })
            .then((weatherData: TmetAPI) => {
                resolve(weatherData)
                cachedWeatherData[queryKey] = { time: Date.now(), data: weatherData }
            })
            .catch(error => {
                console.error("Fetch error:", error)
                resolve(null)
            })
    })
}
