<script lang="ts">
    import { popupData } from "../../../stores"
    import { translate } from "../../../utils/language"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"

    const styleTypes = [
        { id: "normal", name: translate("settings.normal"), icon: "styles" },
        { id: "live", name: translate("tabs.live"), icon: "camera" }
    ]

    function selectStyle(id) {
        popupData.set({ id: "choose_style", value: id })
    }
</script>

<MaterialMultiChoice options={styleTypes} on:click={(e) => selectStyle(e.detail)} />
