<script lang="ts">
    import { stopAiScriptureListening } from "../../ai/scripture/aiScripture"
    import { ai, scriptures } from "../../stores"
    import { translateText } from "../../utils/language"
    import { keysToID, sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import InputRow from "../input/InputRow.svelte"
    import Title from "../input/Title.svelte"
    import Slider from "../inputs/Slider.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"
    import Tip from "../main/Tip.svelte"

    let settings = $ai.scripture || {}

    function update(key: string, value: any) {
        ai.update((a) => {
            if (!a.scripture) a.scripture = {}
            a.scripture[key] = value
            return a
        })
        settings = $ai.scripture || {}
    }

    // engine/model/mic settings live in the AI model manager popup - only scripture behavior lives here

    // MAIN TRANSLATION
    // every installed translation is searched automatically. The favourited translations (the
    // drawer's existing favourites) are the priority pool, and the main translation is the
    // projection/grounding target - unset, the first favourite (or the drawer choice) leads

    $: bibleList = sortByName(keysToID($scriptures).map((bible) => ({ ...bible, name: bible.customName || bible.name })))
    $: mainOptions = [{ value: "", label: translateText("ai_scripture.main_auto") }, ...[...bibleList].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0)).map((bible) => ({ value: bible.id, label: (bible.favorite ? "★ " : "") + bible.name }))]

    const displayTranslationOptions = [
        { value: "drawer", label: translateText("ai_scripture.display_drawer") },
        { value: "matched", label: translateText("ai_scripture.display_matched") }
    ]

    // BEHAVIOR

    const modeOptions = [
        { value: "confirm", label: translateText("ai.mode_confirm") },
        { value: "auto", label: translateText("ai.mode_auto") }
    ]

    // percent threshold for auto-show, with the band it lands in ("high" starts at 80, "medium" at 50)
    $: autoMinConfidence = typeof settings.autoMinConfidence === "number" ? settings.autoMinConfidence : 80
    $: confidenceBand = autoMinConfidence >= 80 ? "high" : autoMinConfidence >= 50 ? "medium" : "low"
    function setAutoMinConfidence(e: any) {
        update("autoMinConfidence", Number(e.target?.value ?? 80))
    }
    // stop any active listening session when the feature is turned off (the session controller follows this toggle)
    function toggleEnabled(e: any) {
        const enabled = !!e.detail
        if (!enabled) stopAiScriptureListening()
        ai.update((a) => {
            if (!a.scripture) a.scripture = {}
            a.scripture.enabled = enabled
            // the feature needs the AI layer - enabling it flips the main AI switch on (never off)
            if (enabled && !a.enabled) a.enabled = true
            return a
        })
        settings = $ai.scripture || {}
    }
</script>

<MaterialToggleSwitch label="ai_scripture.enable" checked={settings.enabled || false} defaultValue={false} on:change={toggleEnabled} />

{#if !settings.enabled}
    <p class="faded" style="padding: 10px 5px;"><T id="ai_scripture.privacy_notice" /></p>
{:else}
    <!-- on-device quote matching always runs - free, offline and keyless. The AI provider (model manager popup) only ADDS paraphrase detection on top -->
    <Title label="ai_scripture.main_translation" icon="star" />

    {#if bibleList.length}
        <MaterialDropdown label="ai_scripture.main_translation" options={mainOptions} value={settings.mainTranslation || ""} defaultValue="" on:change={(e) => update("mainTranslation", e.detail)} />
    {:else}
        <p class="faded"><T id="empty.general" /></p>
    {/if}

    <MaterialDropdown label="ai_scripture.display_translation" options={displayTranslationOptions} value={settings.displayTranslation || "drawer"} defaultValue="drawer" on:change={(e) => update("displayTranslation", e.detail)} />
    <p class="faded hint"><T id="ai_scripture.main_translation_hint" /></p>

    <Title label="ai.behavior" icon="options" />

    <MaterialDropdown label="ai_scripture.mode" options={modeOptions} value={settings.mode || "confirm"} defaultValue="confirm" on:change={(e) => update("mode", e.detail)} />
    {#if (settings.mode || "confirm") === "auto"}
        <Tip type="warning" value="ai_scripture.mode_auto_warning" top={10} />

        <!-- how sure a detection must be before it is shown automatically - the single gate for
        references and quotes alike. Stacked (label / slider+badge): the options column is narrow -->
        <div class="confidenceRow">
            <p class="confidenceLabel"><T id="ai.auto_min_confidence" /></p>
            <div class="confidenceControls">
                <Slider value={autoMinConfidence} min={0} max={100} step={5} style="flex: 1; min-width: 140px;" on:input={setAutoMinConfidence} />
                <span class="confidence {confidenceBand}">{autoMinConfidence}% · <T id="ai.confidence_{confidenceBand}" /></span>
            </div>
        </div>
        <p class="faded hint"><T id="ai_scripture.auto_min_confidence_hint" /></p>
    {/if}

    <MaterialToggleSwitch label="ai_scripture.follow_in_drawer" checked={settings.followInDrawer !== false} defaultValue={true} on:change={(e) => update("followInDrawer", e.detail)} />
    <p class="faded hint"><T id="ai_scripture.follow_in_drawer_hint" /></p>

    <MaterialToggleSwitch label="ai.voice_commands" checked={settings.voiceCommands === true} defaultValue={false} on:change={(e) => update("voiceCommands", e.detail)} />
    {#if settings.voiceCommands}
        <p class="faded"><T id="ai_scripture.voice_commands_hint" /></p>
    {/if}

    <!-- the two cooldowns pair up on one row; max verses is no cooldown, so it gets its own line -->
    <InputRow>
        <MaterialNumberInput label="ai.auto_cooldown" value={Number(settings.autoCooldownSeconds ?? 5)} defaultValue={5} min={0} max={300} on:change={(e) => update("autoCooldownSeconds", e.detail)} />
        <MaterialNumberInput label="ai_scripture.ref_cooldown" value={Number(settings.refCooldownSeconds ?? 90)} defaultValue={90} min={0} max={600} on:change={(e) => update("refCooldownSeconds", e.detail)} />
    </InputRow>
    <MaterialNumberInput label="ai_scripture.max_verses" value={Number(settings.maxVerses ?? 6)} defaultValue={6} min={1} max={20} on:change={(e) => update("maxVerses", e.detail)} />

    <div class="privacy">
        <div class="privacyTitle">
            <Icon id="info" size={1.1} white />
            <T id="ai.privacy" />
        </div>
        <p><T id="ai.privacy_local" /></p>
        <p><T id="ai_scripture.privacy_matching" /></p>
        <p><T id="ai.privacy_llm" /></p>
        <p><T id="ai.privacy_keys" /></p>
    </div>
{/if}

<style>
    .faded {
        opacity: 0.6;
        font-size: 0.85em;
        white-space: initial;
    }
    .hint {
        padding: 5px 10px 10px;
    }

    .confidenceRow {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 8px 10px;
        background-color: var(--primary-darker);
        border-radius: 4px;
        margin-top: 10px;
    }
    .confidenceControls {
        display: flex;
        align-items: center;
        gap: 8px 12px;
        /* narrow column: the slider keeps a usable width and the badge wraps below it */
        flex-wrap: wrap;
    }
    .confidenceLabel {
        font-size: 0.9em;
        white-space: normal;
    }

    .confidence {
        font-size: 0.75em;
        text-transform: uppercase;
        padding: 1px 8px;
        border-radius: 10px;
        white-space: nowrap;
        min-width: 90px;
        text-align: center;
    }
    .confidence.high {
        background-color: rgb(39 168 39 / 0.25);
        color: #6fdc6f;
    }
    .confidence.medium {
        background-color: rgb(255 165 0 / 0.25);
        color: #ffc966;
    }
    .confidence.low {
        background-color: rgb(255 80 80 / 0.25);
        color: #ff9090;
    }

    .privacy {
        margin-top: 25px;
        padding: 12px 15px;
        background-color: var(--primary-darker);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .privacyTitle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.8em;
    }
    .privacy p {
        font-size: 0.75em;
        opacity: 0.7;
        white-space: initial;
    }
</style>
