<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, dataPath, special } from "../../../stores"
    import { send } from "../../../utils/request"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    function setMethod(method: "existing" | "overwrite") {
        if (method === "existing") {
            send(MAIN, ["UPDATE_DATA_PATH"], { reset: false, dataPath: $dataPath })
        } else {
            save(false, { backup: true, changeUserData: { reset: false, dataPath: $dataPath } })
        }

        special.update((a) => {
            a.customUserDataLocation = true
            return a
        })
        activePopup.set(null)
    }
</script>

<p style="max-width: 600px;white-space: normal;"><T id="settings.user_data_exists" /></p>

<br />

<div>
    <Button on:click={() => setMethod("overwrite")} style="border: 2px solid var(--focus);">
        <!-- <Icon id="folder" size={6} /> -->
        <Icon id="check" size={6} />
        <p style="white-space: normal;"><T id="settings.user_data_yes" /></p>
    </Button>
    <Button on:click={() => setMethod("existing")}>
        <Icon id="import" size={6} />
        <p style="white-space: normal;"><T id="settings.user_data_no" /></p>
    </Button>
</div>

<style>
    p {
        display: flex;
        align-items: center;
    }

    div {
        display: flex;
        gap: 10px;
        align-self: center;
    }

    div :global(button) {
        width: 200px;
        height: 200px;

        display: flex;
        gap: 10px;
        flex-direction: column;
        justify-content: center;
    }
</style>
