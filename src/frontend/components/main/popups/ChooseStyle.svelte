<script lang="ts">
    import { popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"

    const styleTypes = [
        { id: "normal", name: translateText("settings.normal"), icon: "styles" },
        { id: "live", name: translateText("tabs.live"), icon: "camera" }
    ]

    function selectStyle(id) {
        popupData.set({ id: "choose_style", value: id })
    }
</script>

<MaterialMultiChoice options={styleTypes} on:click={e => selectStyle(e.detail)} />
