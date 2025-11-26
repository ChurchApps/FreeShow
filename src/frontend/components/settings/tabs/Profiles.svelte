<script lang="ts">
    import type { AccessType, Profile } from "../../../../types/Main"
    import { SettingsTabs } from "../../../../types/Tabs"
    import { activeProfile, categories, folders, overlayCategories, profiles, selectedProfile, stageShows, templateCategories } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { encodePassword } from "../../../utils/profile"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialMultiButtons from "../../inputs/MaterialMultiButtons.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"

    // set id after deletion
    $: if (profileId !== "" && !$profiles[profileId]) profileId = ""

    $: profileId = $selectedProfile || ""
    $: currentProfile = $profiles[profileId] || clone(defaultProfile)

    const defaultProfile: Profile = {
        name: translateText("example.default"),
        color: "",
        image: "",
        access: {}
    }

    // UPDATE

    function updateAccess(key: string, id: string, accessType: AccessType) {
        let data = currentProfile.access

        let accessData = data[key] || {}
        if (id === "global" && accessType === "write" && !accessData[id]) accessData = {}

        accessData[id] = accessType
        if (accessType === "write") delete accessData[id]

        data[key] = accessData
        history({ id: "UPDATE", newData: { key: "access", data }, oldData: { id: profileId }, location: { page: "settings", id: "settings_profile", override: "profile_" + key } })

        // if (key === "shows") updateShowsList($shows)
    }

    // ACCESS

    const accessInputs = [
        { value: "none", label: "profile.none", icon: "disable" },
        { value: "read", label: "profile.read", icon: "eye" },
        { value: "write", label: "profile.write", icon: "edit" }
    ]
    const accessInputsRW = [
        { value: "read", label: "profile.read", icon: "eye" },
        { value: "write", label: "profile.write", icon: "edit" }
    ]

    function getInputs(globalAccess: AccessType | undefined, id: string) {
        const inputs = clone(accessInputs).map((a: any) => {
            a.title = translateText(a.name)
            delete a.name
            return a
        })

        if (globalAccess === "none" || globalAccess === "read") inputs[2].disabled = true
        if (globalAccess === "none") inputs[1].disabled = true

        // remove "none"
        if (id === "functions") inputs.splice(0, 1)
        // remove "read"
        if (id === "settings") inputs.splice(1, 1)

        return inputs
    }

    function getAccessLevel(a: { [key: string]: AccessType }, id: string) {
        const currentLocalLevel = a[id] || "write"
        const currentGlobalLevel = a.global || "write"

        if (currentGlobalLevel === "write") return currentLocalLevel
        if (currentGlobalLevel === "read" && currentLocalLevel === "write") return "read"
        if (currentGlobalLevel === "none") return "none"
        return currentLocalLevel
    }

    /////

    $: projectsList = sortByName(keysToID($folders).filter((a) => a.name && a.parent === "/"))
    $: projectsAccess = currentProfile.access.projects || {}

    $: showsCategoryList = sortByName(keysToID($categories)).filter((a) => a.name && !a.isArchive) //  && !a.default
    $: showsCategoryAccess = currentProfile.access.shows || {}

    $: overlayCategoryList = sortByName(keysToID($overlayCategories)).filter((a) => a.name)
    $: overlayCategoryAccess = currentProfile.access.overlays || {}

    $: templateCategoryList = sortByName(keysToID($templateCategories)).filter((a) => a.name)
    $: templateCategoryAccess = currentProfile.access.templates || {}

    const functions: string[] = ["actions", "timers", "variables", "triggers"]
    $: functionsList = functions.map((id) => ({ id, name: `tabs.${id}` }))
    $: functionsAccess = currentProfile.access.functions || {}

    $: stageList = sortByName(keysToID($stageShows)).filter((a) => a.name)
    $: stageAccess = currentProfile.access.stage || {}

    // "display_settings" (can change position still), "connection" (can use still)
    const tabs: SettingsTabs[] = ["general", "display_settings", "styles", "connection", "files", "profiles", "theme", "other"]
    $: settingsList = tabs.map((id) => ({ id, name: `settings.${id}` }))
    $: settingsAccess = currentProfile.access.settings || {}

    ///

    $: ACCESS_LISTS = [
        { id: "projects", label: "remote.projects", icon: "project", access: projectsAccess, options: accessInputsRW, list: projectsList },
        { id: "shows", label: "tabs.shows", icon: "shows", access: showsCategoryAccess, options: accessInputsRW, list: showsCategoryList },
        // WIP MEDIA (+subtabs)
        // WIP AUDIO
        { id: "overlays", label: "tabs.overlays", icon: "overlays", access: overlayCategoryAccess, options: accessInputsRW, list: overlayCategoryList },
        { id: "templates", label: "tabs.templates", icon: "templates", access: templateCategoryAccess, options: accessInputs, list: templateCategoryList },
        // WIP SCRIPTURE?
        // WIP CALENDAR / ACTION / TIMERS
        { id: "functions", label: "tabs.functions", icon: "functions", access: functionsAccess, options: [], list: functionsList },
        { id: "stage", label: "menu.stage", icon: "stage", access: stageAccess, options: accessInputsRW, list: stageList },
        { id: "settings", label: "menu.settings", icon: "settings", access: settingsAccess, options: [], list: settingsList }
    ]

    $: hasAdminPass = !!$profiles.admin?.password
    function setAdminPassword(e: any) {
        const password = e.detail

        profiles.update((a) => {
            a.admin = { name: "", color: "", image: "", password: password ? encodePassword(password) : "", access: {} }
            return a
        })
    }

    $: profilesList = Object.keys($profiles).filter((a) => a !== "admin")
</script>

{#if $activeProfile !== profileId && profilesList.length}
    <MaterialButton variant="outlined" style="width: 100%;margin-bottom: 10px;" icon="check" on:click={() => activeProfile.set(profileId)}>
        <T id="profile.set_active" />
    </MaterialButton>
{/if}

{#if !profileId || !profilesList.length}
    {#if profilesList.length && !$activeProfile}
        <MaterialTextInput label="remote.password" disabled={hasAdminPass} value={hasAdminPass ? "****" : ""} defaultValue="" on:change={setAdminPassword} />
    {/if}

    <Center style="height: 82%;opacity: 0.1;">
        <Icon id="admin" size={15} white />
    </Center>
{:else}
    {#each ACCESS_LISTS as a}
        <InputRow arrow={!!a.list?.length}>
            <MaterialMultiButtons label={a.label} icon={a.icon} value={a.access.global || "write"} options={a.options} on:click={(e) => updateAccess(a.id, "global", e.detail)} />

            <div slot="menu">
                {#each a.list as item}
                    <InputRow>
                        <MaterialMultiButtons label={item.name} value={getAccessLevel(a.access, item.id)} options={getInputs(a.access.global, a.id)} on:click={(e) => updateAccess(a.id, item.id, e.detail)} noLabels />
                    </InputRow>
                {/each}
            </div>
        </InputRow>
    {/each}
{/if}
