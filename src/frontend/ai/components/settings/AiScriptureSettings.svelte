<script lang="ts">
    import Icon from "../../../components/helpers/Icon.svelte"
    import T from "../../../components/helpers/T.svelte"
    import MaterialToggleSwitch from "../../../components/inputs/MaterialToggleSwitch.svelte"
    import { ai } from "../../../stores"

    // reactive so changes from outside this panel (quick search, voice commands) show up too
    $: settings = $ai.scripture || {}

    function update(key: string, value: any) {
        ai.update((a) => {
            if (!a.scripture) a.scripture = {}
            a.scripture[key] = value
            return a
        })
    }

    // engine/model/mic settings live in the AI model manager popup - only scripture behavior lives here
</script>

<MaterialToggleSwitch label="ai.voice_commands" checked={settings.voiceCommands === true} defaultValue={false} on:change={(e) => update("voiceCommands", e.detail)} />
{#if settings.voiceCommands}
    <p class="faded"><T id="ai_scripture.voice_commands_hint" /></p>
{/if}

<div class="privacy">
    <div class="privacyTitle">
        <Icon id="info" size={1.1} white />
        <T id="ai.privacy" />
    </div>

    <p>Speech is transcribed locally on your computer - audio never leaves the device.</p>
    <p>With an API key set, transcript text is sent to your chosen AI provider while listening to also catch paraphrased references - nothing else.</p>

    <p>Quoted verses are matched against your installed Bibles on this computer - nothing is sent anywhere.</p>
</div>

<style>
    .faded {
        opacity: 0.6;
        font-size: 0.85em;
        white-space: initial;
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
