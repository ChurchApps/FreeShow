<script lang="ts">
    import { uid } from "uid"
    import type { Profile } from "../../../../types/Main"
    import { activeProfile, activeTriggerFunction, dictionary, profiles, selectedProfile } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { generateLightRandomColor } from "../../helpers/color"
    import { history } from "../../helpers/history"
    import Tabs from "../../input/Tabs.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"

    $: profilesList = [{ id: "", color: "", name: $dictionary.profile?.admin || "Admin" }, ...sortByName(keysToID($profiles))]

    // set id after deletion
    $: if (profileId !== "" && !$profiles[profileId]) profileId = ""

    $: profileId = $selectedProfile ?? Object.keys($profiles)[0] ?? ""
    $: currentProfile = $profiles[profileId] || clone(defaultProfile)

    const defaultProfile: Profile = {
        name: $dictionary.example?.default || "Default",
        color: "",
        image: "",
        access: {}
    }

    // UPDATE

    function updateProfile(e: any, key: string, currentId = "") {
        let value = e?.detail ?? e?.target?.value ?? e

        if (!currentId) currentId = profileId || "default"

        // create a profile if nothing exists
        profiles.update((a) => {
            if (!a[currentId]) a[currentId] = clone(currentProfile)

            return a
        })

        history({ id: "UPDATE", newData: { key, data: value }, oldData: { id: currentId }, location: { page: "settings", id: "settings_profile", override: "profile_" + key } })

        selectedProfile.set(currentId)
    }

    // CREATE

    $: if ($activeTriggerFunction === "create_profile") setTimeout(createProfile)
    async function createProfile() {
        // WIP presets for presenter / creator / manager

        if ($activeProfile === null) activeProfile.set("")
        profileId = uid()
        history({ id: "UPDATE", newData: { data: clone(defaultProfile), replace: { name: currentProfile.name + " 2", color: generateLightRandomColor() } }, oldData: { id: profileId }, location: { page: "settings", id: "settings_profile" } })

        selectedProfile.set(profileId)
    }

    let edit: any
</script>

<Tabs id="profile" tabs={profilesList} value={$selectedProfile || ""} newLabel="new.profile" class="context #profile_tab" on:open={(e) => selectedProfile.set(e.detail)} on:create={createProfile} let:tab>
    {#if !tab.id}
        <Icon id="admin" right white />
    {:else}
        <Icon id="profiles" style="fill: {tab.color};" white right />
    {/if}

    {#if $activeProfile === tab.id}<Icon id="check" size={0.7} white right />{/if}
    <HiddenInput value={tab.name} id={"profile_" + tab.id} on:edit={(e) => updateProfile(e.detail.value, "name", tab.id)} bind:edit />
</Tabs>
