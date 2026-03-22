<script lang="ts">
    import { autoOutput, os, special } from "../../../stores"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }
</script>

<MaterialToggleSwitch label="settings.auto_output" checked={$autoOutput} defaultValue={false} on:change={(e) => autoOutput.set(e.detail)} />
<!-- apparently doesn't work on some versions of macOS -->
{#if $os.platform !== "darwin" || $special.hideCursor}
    <MaterialToggleSwitch label="settings.hide_cursor_in_output" checked={$special.hideCursor} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "hideCursor")} />
{/if}
