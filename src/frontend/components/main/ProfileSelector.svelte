<script lang="ts">
    import { activeProfile, os, profiles, special } from "../../stores"
    import { newToast, wait } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import { confirmCustom, promptCustom } from "../../utils/popup"
    import { checkPassword } from "../../utils/profile"
    import { keysToID, sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    $: isWindows = $os.platform === "win32"

    $: profilesList = sortByName(keysToID($profiles).filter((a) => a.id !== "admin"))

    async function selectProfile(id: string) {
        if (id === "") {
            // admin profile
            const adminPassword = $profiles.admin?.password || ""
            if (adminPassword) {
                const pwd = await promptCustom(translateText("remote.password"))
                if (!checkPassword(pwd, adminPassword)) {
                    newToast("remote.wrong_password")
                    return
                }
            } else if (!(await confirmCustom(translateText("profile.choose_admin")))) return
        }

        // wait to avoid popup Svelte transition causing the page to not clear properly
        await wait(50)

        activeProfile.set(id)

        // store last used profile
        special.update((a) => {
            a.lastUsedProfile = id
            return a
        })
    }
</script>

<div class="profiles" style="top: {isWindows ? '25px' : '0'};height: {isWindows ? 'calc(100% - 25px)' : '100%'};">
    <h1>FreeShow</h1>
    <p style="opacity: 0.8;margin-bottom: 20px;"><T id="profile.choose_profile" /></p>

    <div class="flex">
        {#each profilesList as profile}
            <MaterialButton title="profile.set_active: <b>{profile.name}</b>" style="padding: 1.8em;border: 1px solid rgb(255 255 255 / 0.1);" on:click={() => selectProfile(profile.id)}>
                <div class="profile">
                    <Icon id="profiles" size={8} style="fill: {profile.color || 'white'};" white />
                    <p>{profile.name}</p>
                </div>
            </MaterialButton>
        {/each}
    </div>

    <MaterialButton variant="outlined" title="profile.set_active: <b>profile.admin</b>" style="margin-top: 20px;" on:click={() => selectProfile("")}>
        <Icon id="admin" size={2} white />
        <p><T id="profile.admin" /></p>
    </MaterialButton>
</div>

<style>
    h1 {
        font-size: 5em;
        overflow: initial;
    }

    p {
        font-size: 1.2em;
        overflow: initial;
    }

    .profiles {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        background-color: var(--primary);

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        z-index: 99;
    }

    .flex {
        margin-top: 20px;
        display: flex;
        gap: 20px;
    }

    .profile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;

        padding: 0;
    }

    .profile p {
        font-size: 1.3em;

        max-width: 180px;
        overflow: hidden;
    }
</style>
