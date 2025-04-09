<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Link from "../../inputs/Link.svelte"

    let msg: string = ""
    $: msg = $alertMessage.toString()

    // UPDATER
    $: if (msg.includes("freeshow.app")) {
        msg = msg.replace("freeshow.app", '<a href="#void" class="website">freeshow.app</a>')
    }
    $: if (msg.includes("link#")) {
        msg = msg.replace("link#bible-converter", '<a id="bible-converter">Bible Converter</a>')
    }

    function click(e: any) {
        if (e.target.closest(".website")) {
            sendMain(Main.URL, "https://freeshow.app/?download")
        } else if (e.target.closest("a#bible-converter")) {
            sendMain(Main.URL, "https://github.com/vassbo/bible-converter")
        }
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") close()
    }

    function close() {
        activePopup.set(null)
    }
</script>

<svelte:window on:keydown={keydown} />

<p on:click={click}>
    {#key msg}
        {#if msg.includes("captions#")}
            <T id="captions.info" />
            <br />
            <br />
            <Link url={msg.slice(msg.indexOf("#") + 1)}>{msg.slice(msg.indexOf("#") + 1)}</Link>
        {:else if !msg.includes("<") && msg?.length - msg?.replaceAll(".", "").length === 1}
            <T id={msg} />
        {:else}
            {@html msg}
        {/if}
    {/key}
</p>

<br />

<Button on:click={close} center dark>
    <Icon id="check" size={1.2} />
</Button>

<style>
    p {
        white-space: initial;
    }

    p :global(a) {
        color: var(--text);
        opacity: 0.7;

        display: inline-flex;
        gap: 5px;
        align-items: flex-end;

        text-decoration: underline;
        cursor: pointer;

        -webkit-user-drag: none;
    }
    p :global(a):hover {
        opacity: 0.75;
    }
    p :global(a):active {
        opacity: 0.9;
    }
</style>
