<script lang="ts">
    import { drawerTabsData, effects, overlays, selected } from "../../../stores"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"

    const subTab = $drawerTabsData.overlays?.activeSubTab
    const isEffect = subTab === "effects"

    let ids = $selected.data
    let currentValue = (isEffect ? $effects : $overlays)[ids[0]]?.displayDuration || 0

    function updateValue(e: any) {
        let value = e.detail
        currentValue = value

        // WIP history
        ;(isEffect ? effects : overlays).update((a) => {
            ids.forEach((id) => {
                if (!a[id]) return

                if (!value) delete a[id].displayDuration
                else a[id].displayDuration = value
            })
            return a
        })
    }
</script>

<MaterialNumberInput label="timer.seconds" value={currentValue} max={3600} on:change={updateValue} />
