<script lang="ts">
    import { special } from "../../../stores"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    function updateSpecial(value: any, key: string) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }
</script>

<InputRow>
    <MaterialTextInput label="IP" value={$special.icecastHost || "localhost"} on:change={(e) => updateSpecial(e.detail, "icecastHost")} />
    <MaterialNumberInput label="settings.port" value={$special.icecastPort ?? 8000} max={65535} min={1} step={1} on:change={(e) => updateSpecial(e.detail, "icecastPort")} />
</InputRow>
<MaterialTextInput label="Mountpoint" value={$special.icecastMount || "/stream.opus"} on:change={(e) => updateSpecial(e.detail, "icecastMount")} />
<MaterialTextInput label="remote.password" type="password" value={$special.icecastPassword || ""} on:change={(e) => updateSpecial(e.detail, "icecastPassword")} />
