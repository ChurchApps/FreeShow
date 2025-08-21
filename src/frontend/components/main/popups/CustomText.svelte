<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, dictionary, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
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

    function save() {
        if (setValue[id]) setValue[id]()
        activePopup.set(null)
    }

    let text = ""
    const changeValue = (e: CustomEvent<string>) => (text = e.detail)

    // function keydown(e: KeyboardEvent) {
    //     if (e.key === "Enter") save()
    // }
</script>

<!-- <svelte:window on:keydown={keydown} /> -->

<MaterialTextarea label="edit.text" rows={5} placeholder="{$dictionary.empty?.text}..." value={text} on:input={changeValue} autofocus />

<CombinedInput style="margin-top: 10px;">
    <Button on:click={save} style="width: 100%;" center dark>
        <Icon id="save" right />
        <T id="actions.save" />
    </Button>
</CombinedInput>
