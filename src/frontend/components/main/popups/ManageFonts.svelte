<script lang="ts">
    import { onDestroy } from "svelte"
    import type { CustomFont } from "../../../../types/Show"
    import { activePopup, activeProfile, globalCustomFonts, profiles, special } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { loadCustomFont } from "../../helpers/fonts"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    $: fonts = $globalCustomFonts
    $: access = $profiles[$activeProfile || ""]?.access.settings || {}
    $: readOnly = [access.global, access.general].some((level) => level === "read" || level === "none")

    let name = ""
    let loading = false
    let error = ""
    let destroyed = false
    onDestroy(() => (destroyed = true))

    function canEdit() {
        const access = getAccess("settings")
        return ![access.global, access.general].some((level) => level === "read" || level === "none")
    }

    function save(fonts: CustomFont[]) {
        if (!canEdit()) return
        special.update((settings) => ({ ...settings, customFonts: fonts }))
    }

    async function addFont(font: CustomFont) {
        if (loading || !canEdit()) return
        error = ""
        const isDuplicate = (candidate: CustomFont) => (font.path ? candidate.path === font.path : !candidate.path && candidate.name.toLowerCase() === font.name.toLowerCase())
        if (fonts.some(isDuplicate)) {
            error = "fonts.duplicate"
            return
        }
        loading = true
        try {
            const loaded = await loadCustomFont(font)
            if (destroyed || !canEdit()) return
            save([...fonts, loaded])
            name = ""
        } catch {
            error = font.path ? "fonts.local_error" : "fonts.google_error"
        } finally {
            loading = false
        }
    }

    function addGoogleFont() {
        const family = name.trim().replace(/\s+/g, " ")
        if (family) void addFont({ name: family, path: "" })
    }
</script>

<div class="font-manager">
    <p class="hint"><T id="fonts.global_hint" /></p>

    {#each fonts as font, index}
        <div class="font-row">
            <div class="font-details">
                <b>{font.name}</b>
                <span class="hint">{font.path || "Google Fonts"}</span>
            </div>
            <MaterialButton icon="delete" title="actions.delete" disabled={readOnly || loading} on:click={() => save(fonts.filter((_, i) => i !== index))} />
        </div>
    {/each}

    <InputRow>
        <MaterialTextInput id="google-font-family" label="fonts.google_family" value={name} placeholder="Roboto" disabled={readOnly || loading} on:input={(e) => (name = e.detail)} on:keydown={(e) => e.key === "Enter" && addGoogleFont()} />
        <MaterialButton icon="add" title="fonts.add_google" disabled={readOnly || loading || !name.trim()} on:click={addGoogleFont}>
            <T id="fonts.add_google" />
        </MaterialButton>
    </InputRow>
    <p class="hint"><T id="fonts.google_hint" /></p>

    <MaterialFilePicker label="fonts.add_local" value="" filter={{ name: "TrueType / OpenType", extensions: ["ttf", "otf"] }} disabled={readOnly || loading} on:change={(e) => addFont({ name: "", path: e.detail })} />
    <p class="hint"><T id="fonts.local_hint" /></p>

    {#if loading}
        <p role="status"><T id="fonts.loading" /></p>
    {/if}
    {#if error}
        <p role="alert"><T id={error} /></p>
    {/if}

    <MaterialButton variant="outlined" on:click={() => activePopup.set(null)}><T id="actions.close" /></MaterialButton>
</div>

<style>
    .font-manager {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 650px;
    }
    .font-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .font-details {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
    }
    .hint {
        opacity: 0.7;
        font-size: 0.85em;
    }
</style>
