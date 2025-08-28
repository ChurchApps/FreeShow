<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, dataPath, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { save } from "../../../utils/save"
    import T from "../../helpers/T.svelte"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"

    const options = [
        { id: "overwrite", name: translateText("settings.user_data_yes"), icon: "check" }, // folder
        { id: "existing", name: translateText("settings.user_data_no"), icon: "import" }
    ]

    function setMethod(method: "existing" | "overwrite") {
        if (method === "existing") {
            sendMain(Main.UPDATE_DATA_PATH, { reset: false, dataPath: $dataPath })
        } else {
            save(false, { backup: true, isAutoBackup: true, changeUserData: { reset: false, dataPath: $dataPath } })
        }

        special.update((a) => {
            a.customUserDataLocation = true
            return a
        })
        activePopup.set(null)
    }
</script>

<p><T id="settings.user_data_exists" /></p>

<MaterialMultiChoice {options} on:click={(e) => setMethod(e.detail)} />

<style>
    p {
        max-width: 600px;
        white-space: normal;
        margin-bottom: 20px;
        opacity: 0.8;
    }
</style>
