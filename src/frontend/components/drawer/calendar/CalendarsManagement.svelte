<script lang="ts">
    import { calendars, events, special } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { fetchAndImportIcs, getIcsCalendars, isCalendarHidden, toggleCalendarHidden, type IcsCalendar } from "./calendars"

    let syncingCalendars: Record<string, boolean> = {}

    $: icsCalendars = getIcsCalendars($events, $calendars)

    async function syncCalendar(cal: IcsCalendar) {
        if (!cal.url || syncingCalendars[cal.id]) return

        syncingCalendars[cal.id] = true
        const success = await fetchAndImportIcs(cal.url, cal.id)
        syncingCalendars[cal.id] = false

        if (!success) {
            newToast("error.import")
            return
        }
    }
</script>

<!-- TODO: export specific calendar (from context menu) -->

{#if icsCalendars.length > 0}
    <div class="calendars-section" style="margin-top: 10px;">
        <p class="section-title"><T id="calendar.calendars" /></p>

        <div class="calendar-list">
            {#each icsCalendars as cal}
                {@const isHidden = isCalendarHidden($calendars, $special?.hideUnlabeledCalendar, cal.unassigned ? undefined : cal.id)}

                <div class="calendar-card context {cal.unassigned ? '#calendar_item_unlabeled' : '#calendar_item'}" id={cal.id}>
                    <div class="calendar-info">
                        <span class="calendar-color-dot" style="background-color: {cal.unassigned ? 'rgb(255 255 255 / 0.2)' : cal.color || '#FF5733'};" />

                        <div class="calendar-title-col">
                            <p class="calendar-name" data-title={cal.url || cal.name}>{cal.name}</p>
                            <span class="calendar-desc">
                                {#if cal.url}<Icon id="web" size={0.6} white />{/if}
                                <p>{translateText("category.events")}: {cal.count}</p>
                            </span>
                        </div>
                    </div>

                    <div class="calendar-actions">
                        {#if cal.url}
                            <MaterialButton title="cloud.sync" disabled={syncingCalendars[cal.id]} style="padding: 10px;" on:click={() => syncCalendar(cal)}>
                                <Icon id="refresh" class={syncingCalendars[cal.id] ? "spinning" : ""} white />
                            </MaterialButton>
                        {/if}

                        <MaterialButton title={isHidden ? "profile.show" : "profile.hide"} style="padding: 10px;" on:click={() => toggleCalendarHidden(cal.id)}>
                            <Icon id={isHidden ? "hide" : "eye"} white={isHidden} />
                        </MaterialButton>
                    </div>
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .calendars-section {
        display: flex;
        flex-direction: column;
        gap: 5px;

        background-color: var(--primary-darkest);
        border-radius: 4px;
        padding: 8px;
    }

    .section-title {
        font-size: 0.85em;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.7;
    }

    .calendar-list {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .calendar-card {
        display: flex;
        justify-content: space-between;

        background-color: var(--primary-darker);
        border-radius: 4px;
        padding: 6px 8px;

        transition: background-color 0.15s;
    }
    .calendar-card:hover {
        background-color: var(--hover);
    }

    .calendar-info {
        display: flex;
        align-items: center;
        gap: 10px;

        max-width: 70%;
    }

    .calendar-color-dot {
        width: 11px;
        height: 11px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .calendar-title-col {
        display: flex;
        flex-direction: column;

        max-width: 100%;
    }

    .calendar-name {
        font-weight: 500;
        font-size: 0.9em;
    }

    .calendar-desc {
        display: flex;
        align-items: center;
        gap: 4px;

        font-size: 0.75em;
        opacity: 0.6;
    }

    .calendar-actions {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .calendar-actions :global(.spinning) {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        100% {
            transform: rotate(360deg);
        }
    }
</style>
