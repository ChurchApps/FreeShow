<script>
    import { activePopup } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
</script>

<MaterialButton icon="reset" style="width: 100%;padding: 15px;border-top: 2px solid var(--primary-lighter);" on:click={() => activePopup.set("reset_all")} white red>
    {translateText("settings.reset_all")}
</MaterialButton>
