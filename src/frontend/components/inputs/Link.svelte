<script lang="ts">
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"

    export let url: string

    function openURL() {
        sendMain(Main.URL, url)
    }
</script>

<a href="#void" on:click={openURL}>
    <slot />
</a>

<style>
    a {
        color: var(--text);
        opacity: 0.7;

        display: inline-flex;
        gap: 5px;
        align-items: flex-end;

        -webkit-user-drag: none;
    }
    a:hover {
        opacity: 0.75;
    }
    a:active {
        opacity: 0.9;
    }
</style>
