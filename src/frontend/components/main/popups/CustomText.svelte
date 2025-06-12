<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextArea from "../../inputs/TextArea.svelte"

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
    const changeValue = (e: any) => (text = e.target.value)

    // function keydown(e: KeyboardEvent) {
    //     if (e.key === "Enter") save()
    // }
</script>

<!-- <svelte:window on:keydown={keydown} /> -->

<CombinedInput>
    <div style="width: 100%;height: 150px;">
        <TextArea value={text} on:input={(e) => changeValue(e)} autofocus />
    </div>
</CombinedInput>

<CombinedInput style="margin-top: 10px;">
    <Button on:click={save} style="width: 100%;" center dark>
        <Icon id="edit" right />
        <T id="actions.save" />
    </Button>
</CombinedInput>
