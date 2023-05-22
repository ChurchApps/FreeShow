<script lang="ts">
    import { slide } from "svelte/transition"
    import { toastMessages } from "../../stores"
    import T from "../helpers/T.svelte"

    $: messages = $toastMessages
    $: if (messages) startTimer()

    const toastDuration = 4000 // ms
    let currentTimer: any = null

    function startTimer() {
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

            if (a.length) startTimer()
            return a
        })
    }
</script>

{#if messages[0]}
    <div class="toast" transition:slide>
        {#if messages[0][0] === "$"}
            <T id={messages[0].slice(1)} />
        {:else}
            {messages[0]}
        {/if}
    </div>
{/if}

<style>
    .toast {
        position: absolute;
        bottom: 0;
        right: 0;
        max-width: 300px;
        /* bottom: 80px;
        left: 50%;
        transform: translateX(-50%); */
        z-index: 80;

        background-color: var(--primary-darker);
        color: var(--text);
        /* border: 2px solid var(--primary-lighter); */
        border: 2px solid var(--secondary);
        border-bottom: none;
        border-right: none;
        font-size: 1.2em;

        padding: 8px 16px;
    }
</style>
