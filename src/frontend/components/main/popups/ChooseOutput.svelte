<script lang="ts">
    import { popupData } from "../../../stores"
    import { translate } from "../../../utils/language"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"

    const outputTypes = [
        { id: "normal", name: translate("settings.normal"), icon: "display_settings" },
        { id: "stage", name: translate("menu.stage"), icon: "stage" }
    ]

    function selectOutput(id) {
        popupData.set({ id: "choose_output", value: id })
    }
</script>

<MaterialMultiChoice options={outputTypes} on:click={(e) => selectOutput(e.detail)} />
