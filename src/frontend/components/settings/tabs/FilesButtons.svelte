<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { showsCache } from "../../../stores"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    function backup() {
        save(false, { backup: true })
    }

    function restore() {
        showsCache.set({})
        sendMain(Main.RESTORE)
    }
</script>

<InputRow>
    <MaterialButton style="flex: 1;font-size: 1.1em;padding: 20px !important;" title="settings.backup_info" on:click={backup}>
        <Icon id="export" size={1.3} />
        <p><T id="settings.backup_all" /></p>
    </MaterialButton>
    <MaterialButton style="flex: 1;font-size: 1.1em;padding: 20px !important;" on:click={restore}>
        <Icon id="import" size={1.3} />
        <p><T id="settings.restore" /></p>
    </MaterialButton>
</InputRow>
