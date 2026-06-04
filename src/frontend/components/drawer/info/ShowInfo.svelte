<script lang="ts">
    import { EXPORT } from "../../../../types/Channels"
    import type { Line, Show, TrimmedShow } from "../../../../types/Show"
    import { activePopup, activeShow, activeTagFilter, categories, globalTags, popupData, shows, showsCache, special, templates, usageLog } from "../../../stores"
    import { hasNewerUpdate } from "../../../utils/common"
    import { send } from "../../../utils/request"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import Center from "../../system/Center.svelte"
    import Clock from "../../system/Clock.svelte"
    import Date from "../../system/Date.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"

    export let optionsOpen: boolean

    let show: TrimmedShow | null = null
    let fullShow: Show | null = null
    $: if ($shows || $showsCache) updateShows()
    async function updateShows() {
        if (await hasNewerUpdate("SHOW_INFO", 200)) return

        show = $activeShow?.id ? $shows[$activeShow.id] : null
        fullShow = $activeShow?.id ? $showsCache[$activeShow.id] : null
    }

    $: created = show?.timestamps?.created || null
    $: modified = show?.timestamps?.modified || null
    $: used = show?.timestamps?.used || null

    $: category = show?.category ? ($categories[show.category]?.name ?? "error.not_found") || "main.unnamed" : "main.none"

    $: tags = sortByName(keysToID($globalTags).filter((a) => show?.quickAccess?.tags?.includes(a.id))).map(({ name }) => name)

    let words = 0
    let allLines: Line[][]
    $: if (fullShow)
        allLines = _show($activeShow?.id || "")
            .slides()
            .items()
            .lines()
            .get()
    $: if (allLines) getWords()

    function getWords() {
        words = 0
        allLines.forEach((lines) => {
            if (!Array.isArray(lines)) return
            lines.forEach((line) => {
                line?.text?.forEach((text) => (words += text.value?.split(" ").length))
            })
        })
    }

    $: template = fullShow?.settings?.template ? ($templates[fullShow.settings.template]?.name ?? "error.not_found") || "main.unnamed" : "main.none"

    $: info = [{ label: "info.created", value: created, type: "date" }, { label: "info.modified", value: modified, type: "date" }, { label: "info.used", value: used, type: "date" }, { label: "info.category", value: category }, ...(Object.keys($globalTags).length ? [{ label: "meta.tags", value: tags.join(", ") }] : []), { label: "info.slides", value: Object.keys(fullShow?.slides || {}).length }, { label: "info.words", value: words }, { label: "info.template", value: template }]

    // OPTIONS

    function updateSpecial(value: any, key: string) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })
    }

    // usage log

    let exportingUsageLog = false
    let usageLogExported = false
    function exportUsageLog() {
        exportingUsageLog = true
        setTimeout(() => {
            usageLogExported = true
            exportingUsageLog = false
        }, 1000)
        send(EXPORT, ["USAGE"], { content: $usageLog })
    }
    function resetUsageLog() {
        usageLog.set({ all: [] })
        usageLogExported = false
    }
</script>

{#if $activeTagFilter?.length && !optionsOpen}
    <Button style="width: 100%;" on:click={() => activeTagFilter.set([])} center dark>
        <Icon id="close" right />
        <T id="meta.clear_tag_filter" />
    </Button>
{/if}

<div class="scroll">
    {#if optionsOpen}
        <main style="overflow-x: hidden;padding: 10px;">
            <!-- only relevant for opened show really -->
            <MaterialToggleSwitch label="settings.transparent_slides" style="margin-bottom: 5px;" checked={$special.transparentSlides} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "transparentSlides")} />

            <MaterialToggleSwitch label="settings.log_song_usage" checked={$special.logSongUsage || false} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "logSongUsage")} />
            {#if $special.logSongUsage && $usageLog.all?.length}
                <InputRow>
                    <MaterialButton disabled={exportingUsageLog} style="width: 100%;" icon={usageLogExported ? "reset" : "export"} on:click={() => (usageLogExported ? resetUsageLog() : exportUsageLog())}>
                        <T id="actions.{usageLogExported ? 'reset' : 'export'}_usage_log" />
                    </MaterialButton>
                </InputRow>
            {/if}

            <MaterialButton
                variant="outlined"
                icon="autofill"
                title="popup.cleaning_utility"
                style="margin-top: 5px;width: 100%;"
                on:click={() => {
                    popupData.set({ type: "shows" })
                    activePopup.set("cleaning_utility")
                }}
            >
                <T id="popup.cleaning_utility" />
            </MaterialButton>
        </main>
    {:else if $activeShow !== null && ($activeShow.type || "show") === "show"}
        <InfoMetadata title={show?.name} {info} />
    {:else}
        <Center>
            <Clock />
            <Date />
        </Center>
    {/if}
</div>

<style>
    .scroll {
        flex: 1;
    }
</style>
