<script lang="ts">
    import { activeProfile, dictionary, profiles } from "../../stores"
    import { confirmCustom } from "../../utils/popup"
    import { keysToID, sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    const profilesList = [{ id: "", color: "", name: $dictionary.profile?.admin || "Admin" }, ...sortByName(keysToID($profiles))]

    async function selectProfile(id: string) {
        if (id === "" && !(await confirmCustom($dictionary.profile?.choose_admin || "Choose admin profile?"))) return

        activeProfile.set(id)
    }
</script>

<div class="profiles">
    <h1>FreeShow</h1>
    <p><T id="profile.choose_profile" /></p>

    <div class="flex">
        {#each profilesList as profile}
            <Button title="{$dictionary.profile?.set_active}: {profile.name}" style="padding: 1.8em;" on:click={() => selectProfile(profile.id)}>
                <div class="profile">
                    <Icon id={profile.id ? "profiles" : "admin"} size={8} style="fill: {profile.color || 'white'};" />
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
