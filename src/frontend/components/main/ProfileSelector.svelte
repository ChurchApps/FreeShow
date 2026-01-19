<script lang="ts">
    import { activeProfile, profiles, special } from "../../stores"
    import { newToast, wait } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import { confirmCustom, promptCustom } from "../../utils/popup"
    import { checkPassword } from "../../utils/profile"
    import { keysToID, sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    const profilesList = [{ id: "", color: "", name: translateText("profile.admin") }, ...sortByName(keysToID($profiles).filter((a) => a.id !== "admin"))]

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

<div class="profiles">
    <h1>FreeShow</h1>
    <p><T id="profile.choose_profile" /></p>

    <div class="flex">
        {#each profilesList as profile}
            <Button title="{translateText('profile.set_active')}: {profile.name}" style="padding: 1.8em;" on:click={() => selectProfile(profile.id)}>
                <div class="profile">
                    <Icon id={profile.id ? "profiles" : "admin"} size={8} style="fill: {profile.color || 'white'};" white />
                    <p>{profile.name}</p>
                </div>
            </Button>
        {/each}
    </div>
</div>

<style>
    h1 {
        font-size: 5em;
        overflow: initial;
    }

    p {
        font-size: 1.3em;
        overflow: initial;
    }

    .profiles {
        width: 100%;
        height: 100%;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
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
