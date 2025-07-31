<script lang="ts">
    import { uid } from "uid"
    import type { AccessType, Profile } from "../../../../types/Main"
    import { SettingsTabs } from "../../../../types/Tabs"
    import { activeProfile, activeTriggerFunction, categories, dictionary, folders, overlayCategories, profiles, selectedProfile, stageShows, templateCategories } from "../../../stores"
    import { translate } from "../../../utils/language"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { generateLightRandomColor } from "../../helpers/color"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import MultiInputs from "../../inputs/MultiInputs.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    $: profilesList = [{ id: "", color: "", name: $dictionary.profile?.admin || "Admin" }, ...sortByName(keysToID($profiles))]

    // set id after deletion
    $: if (profileId !== "" && !$profiles[profileId]) profileId = ""

    let profileId = $selectedProfile ?? Object.keys($profiles)[0] ?? ""
    $: currentProfile = $profiles[profileId] || clone(defaultProfile)

    $: selectedProfile.set(profileId ?? null)
    $: if ($selectedProfile !== null) updateStyleId()
    function updateStyleId() {
        profileId = $selectedProfile!
    }

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

        profileId = currentId
    }

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

    let edit: any

    // const isChecked = (e: any) => e.target.checked

    // CREATE

    $: if ($activeTriggerFunction === "create_profile") setTimeout(createProfile)
    async function createProfile() {
        // WIP presets for presenter / creator / manager

        if ($activeProfile === null) activeProfile.set("")
        profileId = uid()
        history({ id: "UPDATE", newData: { data: clone(defaultProfile), replace: { name: currentProfile.name + " 2", color: generateLightRandomColor() } }, oldData: { id: profileId }, location: { page: "settings", id: "settings_profile" } })
    }

    // ACCESS

    const accessInputs = [
        { id: "none", name: "profile.none", icon: "disable" },
        { id: "read", name: "profile.read", icon: "eye" },
        { id: "write", name: "profile.write", icon: "edit" }
    ]
    function getInputs(globalAccess: AccessType | undefined, removeIndex: number = -1) {
        const inputs = clone(accessInputs).map((a: any) => {
            a.title = translate(a.name)
            delete a.name
            return a
        })

        if (globalAccess === "none" || globalAccess === "read") inputs[2].disabled = true
        if (globalAccess === "none") inputs[1].disabled = true

        if (removeIndex > -1) inputs.splice(removeIndex, 1)

        return inputs
    }
    function noNoneInputs() {
        const inputs = clone(accessInputs) as any
        // inputs[0].disabled = true
        inputs.splice(0, 1)
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

    let openedLists: string[] = []
    function toggleList(id: string) {
        if (openedLists.includes(id)) openedLists.splice(openedLists.indexOf(id, 1))
        else openedLists.push(id)
        openedLists = openedLists
    }

    $: projectsList = sortByName(keysToID($folders).filter((a) => a.parent === "/"))
    $: projectsAccess = currentProfile.access.projects || {}

    $: showsCategoryList = sortByName(keysToID($categories)).filter((a) => !a.isArchive) //  && !a.default
    $: showsCategoryAccess = currentProfile.access.shows || {}

    $: overlayCategoryList = sortByName(keysToID($overlayCategories))
    $: overlayCategoryAccess = currentProfile.access.overlays || {}

    $: templateCategoryList = sortByName(keysToID($templateCategories))
    $: templateCategoryAccess = currentProfile.access.templates || {}

    const functions: string[] = ["actions", "timers", "variables", "triggers"]
    $: functionsList = functions.map((id) => ({ id, name: `tabs.${id}` }))
    $: functionsAccess = currentProfile.access.functions || {}

    $: stageList = sortByName(keysToID($stageShows))
    $: stageAccess = currentProfile.access.stage || {}

    // "display_settings" (can change position still), "connection" (can use still)
    const tabs: SettingsTabs[] = ["general", "display_settings", "styles", "connection", "files", "profiles", "theme", "other"]
    $: settingsList = tabs.map((id) => ({ id, name: `settings.${id}` }))
    $: settingsAccess = currentProfile.access.settings || {}
</script>

{#if !profileId}
    <div class="info">
        <p><T id="profile.profiles_hint" /></p>
    </div>
{/if}

{#if $activeProfile !== profileId && Object.keys($profiles).length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={() => activeProfile.set(profileId)} center dark>
            <Icon id="check" right />
            <p style="flex: 0;min-width: inherit;"><T id="profile.set_active" /></p>
        </Button>
    </CombinedInput>
{/if}

{#if !profileId || !Object.keys($profiles).length}
    <Center style="height: 65%;opacity: 0.1;">
        <Icon id="admin" size={15} white />
    </Center>
{:else}
    <!-- PROJECTS -->

    <h3>
        <Icon id="project" white />
        <T id="remote.projects" />
    </h3>

    <CombinedInput>
        <p class="global"><T id="groups.global" /></p>
        <MultiInputs inputs={noNoneInputs()} active={projectsAccess.global || "write"} on:click={(e) => updateAccess("projects", "global", e.detail)} />

        {#if projectsList.length}
            <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => toggleList("projects")}>
                {#if openedLists.includes("projects")}
                    <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                {:else}
                    <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                {/if}
            </Button>
        {/if}
    </CombinedInput>
    {#if openedLists.includes("projects")}
        {#each projectsList as item}
            <CombinedInput>
                <p>{item.name}</p>
                <MultiInputs inputs={getInputs(projectsAccess.global)} active={getAccessLevel(projectsAccess, item.id)} on:click={(e) => updateAccess("projects", item.id, e.detail)} />
            </CombinedInput>
        {/each}
    {/if}

    <!-- SHOW CATEGORIES -->

    <h3>
        <Icon id="shows" white />
        <!-- <T id="guide_title.categories" />:  -->
        <T id="tabs.shows" />
    </h3>

    <CombinedInput>
        <p class="global"><T id="groups.global" /></p>
        <MultiInputs inputs={noNoneInputs()} active={showsCategoryAccess.global || "write"} on:click={(e) => updateAccess("shows", "global", e.detail)} />

        {#if showsCategoryList.length}
            <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => toggleList("shows")}>
                {#if openedLists.includes("shows")}
                    <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                {:else}
                    <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                {/if}
            </Button>
        {/if}
    </CombinedInput>
    {#if openedLists.includes("shows")}
        <!-- {#if showsCategoryList.length} -->
        {#each showsCategoryList as item}
            <CombinedInput>
                <p>
                    {#if item.default}<T id={item.name} />{:else}{item.name}{/if}
                </p>
                <MultiInputs inputs={getInputs(showsCategoryAccess.global)} active={getAccessLevel(showsCategoryAccess, item.id)} on:click={(e) => updateAccess("shows", item.id, e.detail)} />
            </CombinedInput>
        {/each}
        <!-- {:else}
            <p class="empty">
                <T id="empty.general" />
            </p>
        {/if} -->
    {/if}

    <!-- WIP MEDIA (+subtabs) -->
    <!-- WIP AUDIO -->

    <!-- OVERLAY CATEGORIES -->

    <h3>
        <Icon id="overlays" white />
        <!-- <T id="guide_title.categories" />:  -->
        <T id="tabs.overlays" />
    </h3>

    <CombinedInput>
        <p class="global"><T id="groups.global" /></p>
        <MultiInputs inputs={noNoneInputs()} active={overlayCategoryAccess.global || "write"} on:click={(e) => updateAccess("overlays", "global", e.detail)} />

        {#if overlayCategoryList.length}
            <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => toggleList("overlays")}>
                {#if openedLists.includes("overlays")}
                    <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                {:else}
                    <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                {/if}
            </Button>
        {/if}
    </CombinedInput>
    {#if openedLists.includes("overlays")}
        {#each overlayCategoryList as item}
            <CombinedInput>
                <p>
                    {#if item.default}<T id={item.name} />{:else}{item.name}{/if}
                </p>
                <MultiInputs inputs={getInputs(overlayCategoryAccess.global)} active={getAccessLevel(overlayCategoryAccess, item.id)} on:click={(e) => updateAccess("overlays", item.id, e.detail)} />
            </CombinedInput>
        {/each}
    {/if}

    <!-- TEMPLATES CATEGORIES -->

    <h3>
        <Icon id="templates" white />
        <!-- <T id="guide_title.categories" />:  -->
        <T id="tabs.templates" />
    </h3>

    <CombinedInput>
        <p class="global"><T id="groups.global" /></p>
        <MultiInputs inputs={accessInputs} active={templateCategoryAccess.global || "write"} on:click={(e) => updateAccess("templates", "global", e.detail)} />

        {#if templateCategoryList.length}
            <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => toggleList("templates")}>
                {#if openedLists.includes("templates")}
                    <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                {:else}
                    <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                {/if}
            </Button>
        {/if}
    </CombinedInput>
    {#if openedLists.includes("templates")}
        {#each templateCategoryList as item}
            <CombinedInput>
                <p>
                    {#if item.default}<T id={item.name} />{:else}{item.name}{/if}
                </p>
                <MultiInputs inputs={getInputs(templateCategoryAccess.global)} active={getAccessLevel(templateCategoryAccess, item.id)} on:click={(e) => updateAccess("templates", item.id, e.detail)} />
            </CombinedInput>
        {/each}
    {/if}

    <!-- WIP SCRIPTURE? -->
    <!-- WIP CALENDAR / ACTION / TIMERS -->

    <!-- DRAWER -->

    <h3>
        <Icon id="functions" white />
        <T id="tabs.functions" />
    </h3>

    {#each functionsList as item}
        <CombinedInput>
            <p><T id={item.name} /></p>
            <MultiInputs inputs={getInputs(functionsAccess.global, 0)} active={getAccessLevel(functionsAccess, item.id)} on:click={(e) => updateAccess("functions", item.id, e.detail)} />
        </CombinedInput>
    {/each}

    <!-- STAGE -->

    <h3>
        <Icon id="stage" white />
        <T id="menu.stage" />
    </h3>

    <CombinedInput>
        <p class="global"><T id="groups.global" /></p>
        <MultiInputs inputs={noNoneInputs()} active={stageAccess.global || "write"} on:click={(e) => updateAccess("stage", "global", e.detail)} />

        {#if stageList.length}
            <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => toggleList("stage")}>
                {#if openedLists.includes("stage")}
                    <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                {:else}
                    <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                {/if}
            </Button>
        {/if}
    </CombinedInput>
    {#if openedLists.includes("stage")}
        {#each stageList as item}
            <CombinedInput>
                <p>{item.name}</p>
                <MultiInputs inputs={getInputs(stageAccess.global)} active={getAccessLevel(stageAccess, item.id)} on:click={(e) => updateAccess("stage", item.id, e.detail)} />
            </CombinedInput>
        {/each}
    {/if}

    <!-- SETTINGS -->

    <h3>
        <Icon id="settings" white />
        <T id="menu.settings" />
    </h3>

    {#each settingsList as item}
        <CombinedInput>
            <p><T id={item.name} /></p>
            <MultiInputs inputs={getInputs(settingsAccess.global, 1)} active={getAccessLevel(settingsAccess, item.id)} on:click={(e) => updateAccess("settings", item.id, e.detail)} />
        </CombinedInput>
    {/each}
{/if}

<div class="filler" style={profilesList.length > 1 ? "height: 76px;" : ""} />
<div class="bottom">
    {#if profilesList.length > 1}
        <div style="display: flex;overflow-x: auto;">
            {#each profilesList as currentProfile}
                {@const selected = profileId === currentProfile.id}
                {@const active = $activeProfile === currentProfile.id}

                <SelectElem id="profile" data={{ id: currentProfile.id }} fill>
                    <Button border={selected} class={currentProfile.id ? "context #profile_tab" : ""} active={selected} style="width: 100%;" on:click={() => (profileId = currentProfile.id)} bold={false} center>
                        {#if !currentProfile.id}
                            <Icon id="admin" right white />
                        {:else}
                            <Icon id="profiles" style="fill: {currentProfile.color};" right />
                        {/if}

                        {#if active}<Icon id="check" size={0.7} white right />{/if}
                        <HiddenInput value={currentProfile.name} id={"profile_" + currentProfile.id} on:edit={(e) => updateProfile(e.detail.value, "name", currentProfile.id)} bind:edit />
                    </Button>
                </SelectElem>
            {/each}
        </div>
    {/if}

    <div style="display: flex;">
        <Button style="width: 100%;" on:click={createProfile} center>
            <Icon id="add" right />
            <T id="new.profile" />
        </Button>
    </div>
</div>

<style>
    .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        min-height: 38px;
        margin: 5px 0;
        margin-bottom: 15px;
        font-style: italic;
        opacity: 0.8;
    }

    .info p {
        white-space: initial;
    }

    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

    .global {
        font-weight: 500;
    }

    /* .empty {
        width: 100%;
        text-align: center;
        padding: 20px;
        opacity: 0.5;
    } */

    .filler {
        height: 48px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        inset-inline-start: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }
</style>
