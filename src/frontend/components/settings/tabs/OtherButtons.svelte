<script>
    import { activePopup } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
</script>

<MaterialButton icon="reset" style="width: 100%;padding: 15px;border-top: 2px solid var(--primary-lighter);background-color: rgb(255 0 0 / 0.25) !important;" on:click={() => activePopup.set("reset_all")} white>
    {translateText("settings.reset_all")}
</MaterialButton>
