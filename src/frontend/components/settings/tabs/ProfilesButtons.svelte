<script lang="ts">
    import { activeProfile, profiles, selectedProfile, special } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { promptCustom } from "../../../utils/popup"
    import { checkPassword } from "../../../utils/profile"
    import { runActionId } from "../../actions/actions"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    $: profileId = $selectedProfile || ""

    $: profilesList = Object.keys($profiles).filter((a) => a !== "admin")
    $: hasAdminPass = !!$profiles.admin?.password

    async function setCurrentAsActive() {
        // require password if setting admin profile (and password exists)
        if (profileId === "" && hasAdminPass) {
            const pwd = await promptCustom(translateText("remote.password"), "password")
            const adminPassword = $profiles.admin?.password || ""
            if (!checkPassword(pwd, adminPassword)) {
                newToast("remote.wrong_password")
                return
            }
        }

        activeProfile.set(profileId)

        // run action
        const actionId = $profiles[profileId]?.action
        if (actionId) runActionId(actionId, "profile")

        // store last used profile
        special.update((a) => {
            a.lastUsedProfile = profileId
            return a
        })
    }
</script>

{#if $activeProfile !== profileId && profilesList.length}
    <MaterialButton variant="outlined" style="padding: 6px 10px;font-size: 0.85em;" icon="check" on:click={setCurrentAsActive} white>
        <T id="profile.set_active" />
    </MaterialButton>
{/if}
