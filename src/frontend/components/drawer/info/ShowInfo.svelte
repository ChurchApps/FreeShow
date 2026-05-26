<script lang="ts">
    import type { Line, Show, TrimmedShow } from "../../../../types/Show"
    import { activeShow, activeTagFilter, categories, globalTags, shows, showsCache, special, templates } from "../../../stores"
    import { hasNewerUpdate } from "../../../utils/common"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"

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

    let settingsOpened = false

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }
</script>

{#if $activeTagFilter?.length && !settingsOpened}
    <Button style="width: 100%;" on:click={() => activeTagFilter.set([])} center dark>
        <Icon id="close" right />
        <T id="meta.clear_tag_filter" />
    </Button>
{/if}

<div class="scroll">
    {#if settingsOpened}
        <main style="overflow-x: hidden;padding: 10px;">
            <MaterialToggleSwitch label="settings.transparent_slides" checked={$special.transparentSlides} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "transparentSlides")} />
        </main>
    {:else}
        <InfoMetadata title={show?.name} {info} />
    {/if}
</div>

<FloatingInputs round>
    <MaterialButton isActive={settingsOpened} title="edit.options" on:click={() => (settingsOpened = !settingsOpened)}>
        <Icon size={1.1} id="options" white={!settingsOpened} />
    </MaterialButton>
</FloatingInputs>

<style>
    .scroll {
        flex: 1;
    }
</style>
