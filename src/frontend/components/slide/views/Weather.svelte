<script lang="ts">
    import type { Weather } from "../../../../types/Show"
    import { dictionary, timeFormat } from "../../../stores"
    import { getWeather } from "../../../utils/weather"
    import T from "../../helpers/T.svelte"

    export let data: Weather

    $: if (data) updateWeather()

    $: size = (data.size || 100) / 100

    let updated = ""
    let times: any[] = []
    async function updateWeather() {
        const weather = await getWeather(data)
        if (!weather) return

        updated = weather.properties.meta.updated_at
        let units = weather.properties.meta.units
        if (data.useFahrenheit) units.air_temperature = "fahrenheit"
        const u_wind_speed = " " + units.wind_speed
        const u_temp = "° " + ({ celsius: "C", fahrenheit: "F" }[units.air_temperature] || "C")

        const now = new Date()
        let timestamps: number[] = []
        if (data.longRange) {
            now.setHours(12, 0, 0, 0)
            timestamps = [now.getTime(), now.setDate(now.getDate() + 1), now.setDate(now.getDate() + 1), now.setDate(now.getDate() + 1)]
        } else {
            now.setHours(now.getHours() + 1, 0, 0, 0)
            // get more specific times? (9, 12, 15, 18, 21)
            timestamps = [now.getTime(), now.setHours(now.getHours() + 3, 0, 0, 0), now.setHours(now.getHours() + 3, 0, 0, 0), now.setHours(now.getHours() + 5, 0, 0, 0)]
        }

        times = timestamps
            .map((a, i) => {
                const currentTime = new Date(a)
                let dayIndex = currentTime.getDay() === 0 ? 7 : currentTime.getDay()
                const dayname = i === 0 ? $dictionary.calendar?.today : i === 1 ? $dictionary.calendar?.tomorrow : $dictionary.weekday?.[dayIndex]
                const isoTime = toGlobalISO(a)
                let timedata = weather.properties.timeseries.find((a) => a.time === isoTime)
                if (timedata && i === 0) timedata = weather.properties.timeseries[0]
                if (!timedata) return null

                return {
                    name: data.longRange ? dayname : i === 0 ? $dictionary.calendar?.now : getTime(a),
                    icon: (timedata?.data.next_1_hours || timedata?.data.next_6_hours)?.summary.symbol_code,
                    temperature: convertTemperature(timedata.data.instant.details.air_temperature || 0, !!data.useFahrenheit) + u_temp,
                    wind_speed: timedata.data.instant.details.wind_speed + u_wind_speed
                }
            })
            .filter(Boolean)
    }

    function convertTemperature(value: number, useFahrenheit: boolean) {
        if (!useFahrenheit) return value
        return ((value * 9) / 5 + 32).toFixed(1).replace(".0", "")
    }

    // '2025-12-30T12:00:00Z'
    function toGlobalISO(time: number | string) {
        const currentTime = new Date(time)
        // return currentTime.toISOString().replace(".000Z", "Z")
        return `${currentTime.getFullYear()}-${(currentTime.getMonth() + 1).toString().padStart(2, "0")}-${currentTime.getDate().toString().padStart(2, "0")}T${currentTime.getHours().toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")}:${currentTime.getSeconds().toString().padStart(2, "0")}Z`
    }

    function getTime(time: number | string) {
        const currentTime = new Date(time)
        const twelve = $timeFormat === "12"

        let h = currentTime.getHours()

        // 12-hour
        if (twelve) {
            if (h === 0) h = 12
            else if (h > 12) h -= 12

            return `${h.toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")} ${currentTime.getHours() >= 12 ? "PM" : "AM"}`
        }

        // 24-hour
        return `${h.toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")}`
    }
</script>

<div class="weather" style="font-size: {size}em;">
    {#if data.latitude && data.longitude}
        {#if times.length}
            {#each times as time}
                <div class="time">
                    <p style="font-size: 0.8em;">{time.name}</p>
                    {#if time.icon}
                        <img src="./assets/weather/{time.icon}.svg" alt={time.icon} height="{280 * size}px" width="{280 * size}px" />
                    {/if}
                    <p style="font-size: 1em;">{time.temperature}</p>
                    <p style="font-size: 0.4em;">{time.wind_speed}</p>
                </div>
            {/each}

            <p class="credits">
                Data from MET Norway
                {#if updated}
                    (Last update: {getTime(updated)})
                {/if}
            </p>
        {:else}
            <T id="remote.loading" />
        {/if}
    {:else}
        <!-- No data -->
    {/if}
</div>

<style>
    .weather {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;

        padding-bottom: 20px;

        width: 100%;
        height: 100%;

        pointer-events: none;
    }

    .credits {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);

        opacity: 0.4;
        font-size: 0.3em;
    }

    .time {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .weather p {
        overflow: visible;
        text-shadow: none;
    }
</style>
