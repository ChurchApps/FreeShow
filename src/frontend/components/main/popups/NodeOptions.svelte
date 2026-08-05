<script lang="ts">
    import { popupData, special } from "../../../stores"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    const nodeId = $popupData?.nodeId
    popupData.set(null)

    function updateSpecial(value: any, key: string) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }
</script>

{#if nodeId === "icecast"}
    <InputRow>
        <MaterialTextInput label="IP" value={$special.icecastHost || "localhost"} on:change={(e) => updateSpecial(e.detail, "icecastHost")} />
        <MaterialNumberInput label="settings.port" value={$special.icecastPort ?? 8000} max={65535} min={1} step={1} on:change={(e) => updateSpecial(e.detail, "icecastPort")} />
    </InputRow>
    <MaterialTextInput label="Mountpoint" value={$special.icecastMount || "/stream.opus"} on:change={(e) => updateSpecial(e.detail, "icecastMount")} />
    <MaterialTextInput label="remote.password" type="password" value={$special.icecastPassword ?? "hackme"} defaultValue="hackme" on:change={(e) => updateSpecial(e.detail, "icecastPassword")} />
{/if}
