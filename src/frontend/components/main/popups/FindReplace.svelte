<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { format } from "../../context/menuClick"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let findValue = ""
    let replaceValue = ""

    let caseSentitive = true

    function replace() {
        if (!findValue) {
            newToast("empty.input")
            return
        }

        let obj = $popupData
        popupData.set({})

        format("find_replace", obj, { findValue, replaceValue, caseSentitive })
        activePopup.set(null)
    }

    let showMore = false
</script>

<MaterialButton class="popup-options {showMore ? 'active' : ''}" icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} on:click={() => (showMore = !showMore)} white />

{#if showMore}
    <MaterialToggleSwitch label="actions.case_sensitive" checked={caseSentitive} defaultValue={true} on:change={(e) => (caseSentitive = e.detail)} />
{/if}
<MaterialTextInput label="actions.find" value={findValue} on:change={(e) => (findValue = e.detail)} autofocus />
<MaterialTextInput label="actions.replace" value={replaceValue} on:change={(e) => (replaceValue = e.detail)} />

<MaterialButton style="margin-top: 20px;" variant="contained" on:click={replace}>
    <Icon id="find_replace" size={1.2} white />
    <T id="actions.find_replace" />
</MaterialButton>
