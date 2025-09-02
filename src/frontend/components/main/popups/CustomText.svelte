<script lang="ts">
    import { onMount } from "svelte"
    import { dictionary, special } from "../../../stores"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"

    let id = "splash"

    const getValue = {
        splash: () => $special.splashText || ""
    }
    const setValue = {
        splash: () => {
            special.update((a) => {
                a.splashText = text
                return a
            })
        }
    }

    onMount(() => {
        if (getValue[id]) text = getValue[id]()
    })

    let text = ""
    function changeValue(e: CustomEvent<string>) {
        text = e.detail
        if (setValue[id]) setValue[id]()
    }
</script>

<MaterialTextarea label="edit.text" rows={5} placeholder="{$dictionary.empty?.text}..." value={text} on:change={changeValue} autofocus />
