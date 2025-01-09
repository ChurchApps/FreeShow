<script lang="ts">
    import { overlays, selected } from "../../../stores"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    let overlayIds = $selected.data
    let currentValue = $overlays[overlayIds[0]]?.displayDuration || 0

    function updateValue(e: any) {
        let value = Number(e.detail)
        currentValue = value

        // WIP history
        overlays.update((a) => {
            overlayIds.forEach((id) => {
                if (!value) delete a[id].displayDuration
                else a[id].displayDuration = value
            })
            return a
        })
    }
</script>

<CombinedInput>
    <NumberInput value={currentValue} on:change={updateValue} max={3600} fixed={currentValue?.toString()?.includes(".") ? 1 : 0} decimals={1} />
</CombinedInput>
