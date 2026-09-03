<script lang="ts">
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

<style>
    .faded {
        opacity: 0.6;
        font-size: 0.85em;
        white-space: initial;
    }
</style>
