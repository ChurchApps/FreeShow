<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import { format } from "../../context/menuClick"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let findValue = ""
    let replaceValue = ""

    let caseSentitive: boolean = true

    function replace() {
        if (!findValue) {
            newToast("$empty.input")
            return
        }

        let obj = $popupData
        popupData.set({})

        format("find_replace", obj, { findValue, replaceValue, caseSentitive })
        activePopup.set(null)
    }

    function updateValue(e, key) {
        let value = e.target.value

        if (key === "find") findValue = value
        else if (key === "replace") replaceValue = value
    }
</script>

<CombinedInput>
    <p><T id="actions.find" /></p>
    <TextInput value={findValue} on:change={(e) => updateValue(e, "find")} />
</CombinedInput>
<CombinedInput>
    <p><T id="actions.replace" /></p>
    <TextInput value={replaceValue} on:change={(e) => updateValue(e, "replace")} />
</CombinedInput>
<CombinedInput>
    <p><T id="actions.case_sensitive" /></p>
    <div class="alignRight">
        <Checkbox checked={caseSentitive} on:change={() => (caseSentitive = !caseSentitive)} />
    </div>
</CombinedInput>

<CombinedInput>
    <Button on:click={replace} style="width: 100%;" center>
        <Icon id="find_replace" size={1.2} right />
        <T id="actions.find_replace" />
    </Button>
</CombinedInput>
