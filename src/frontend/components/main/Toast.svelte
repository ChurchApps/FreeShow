<script lang="ts">
    import { slide } from "svelte/transition"
    import { toastMessages } from "../../stores"
    import { translateText } from "../../utils/language"

    $: messages = $toastMessages
    $: if (messages?.length) startTimer()

    const toastDuration = 4000 // ms
    let currentTimer: NodeJS.Timeout | null = null

    const clearEarly = [
        { if: "toast.saving", when: "toast.saved" },
        { if: "toast.recording_started", when: "toast.recording_stopped" }
    ]

    function startTimer() {
        // clear some early
        if (clearEarly.find((c) => messages[0] === c.if && messages.find((a) => a === c.when))) {
            if (currentTimer) clearTimeout(currentTimer)
            currentTimer = null
            removeCurrent()
        }

        if (currentTimer) return
        currentTimer = setTimeout(() => {
            currentTimer = null
            if (!messages.length) return

            removeCurrent()
        }, toastDuration)
    }

    function removeCurrent() {
        toastMessages.update((a) => {
            a.shift()
            return a
        })
    }
</script>

{#if messages?.[0]}
    <div class="toast" transition:slide>
        {translateText(messages[0])}
    </div>
{/if}

<style>
    .toast {
        position: absolute;
        bottom: 0;
        inset-inline-end: 4px;
        max-width: calc(var(--navigation-width) - 6px);
        z-index: 5000;

        background-color: var(--primary-darker);
        color: var(--text);
        border: 2px solid var(--secondary);

        border-radius: 8px;
        /* border-top-left-radius: 8px;
        border-bottom-left-radius: 8px;
        border-inline-end: none; */
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        border-bottom: none;

        font-size: 1.2em;
        padding: 8px 16px;

        /* line-break: anywhere; */
        overflow-x: auto;

        box-shadow: -2px -2px 5px rgb(0 0 0 / 0.2);
    }
</style>
