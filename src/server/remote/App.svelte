<script lang="ts">
    import Center from "../common/components/Center.svelte"
    import Error from "../common/components/Error.svelte"
    import Auth from "./components/Auth.svelte"
    import Main from "./components/Main.svelte"
    import { translate } from "./util/helpers"
    import { initSocket } from "./util/socket"
    import { dictionary, errors, isConnected, password } from "./util/stores"

    initSocket()

    // test API actions
    // send("API:get_playlists")
</script>

<Error errors={$errors} />

{#if $isConnected}
    <Main />
{:else if $password.required}
    <Auth />
{:else}
    <Center>
        {translate("remote.loading", $dictionary)}
    </Center>
{/if}

<svelte:head>
    <style>
        :root {
            --primary: #242832;
            --primary-lighter: #2f3542;
            --primary-darker: #191923;
            --primary-darkest: #12121c;
            --text: #f0f0ff;
            --textInvert: #131313;
            --secondary: #f0008c;
            --secondary-opacity: rgba(240, 0, 140, 0.5);
            --secondary-text: #f0f0ff;
            --transparent: #232530;

            --accent: #90caf9;

            --connected: #27a827;
            --disconnected: #a82727;

            --red: rgb(255 0 0 / 0.25);

            --hover: rgb(255 255 255 / 0.05);
            --focus: rgb(255 255 255 / 0.1);
            /* --active: rgb(230 52 156 / .8); */

            /* --navigation-width: 18vw; */
            --navigation-width: 300px;

            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
            --font-size: 1em;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            user-select: none;

            outline-offset: -4px;
            outline-color: var(--secondary);
        }

        html {
            height: 100%;
            font-family: var(--font-family);
            font-size: var(--font-size);
        }

        body {
            background-color: var(--primary);
            color: var(--text);
            transition: background-color 0.5s;

            font-family: inherit;
            font-size: inherit;

            height: 100%;
            display: flex;
            flex-direction: column;
            touch-action: manipulation;
        }

        /* Match FreeShow main app scrollbar */
        :global(::-webkit-scrollbar) {
            width: 8px;
            height: 8px;
        }
        :global(::-webkit-scrollbar-track),
        :global(::-webkit-scrollbar-corner) {
            background: rgb(255 255 255 / 0.05);
        }
        :global(::-webkit-scrollbar-thumb) {
            background: rgb(255 255 255 / 0.3);
        }
        :global(::-webkit-scrollbar-thumb:hover) {
            background: rgb(255 255 255 / 0.5);
        }

        .scrollbar-styled {
            scrollbar-width: thin; /* Firefox */
            scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
        }
        .scrollbar-styled::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        .scrollbar-styled::-webkit-scrollbar-track,
        .scrollbar-styled::-webkit-scrollbar-corner {
            background: rgb(255 255 255 / 0.05);
        }
        .scrollbar-styled::-webkit-scrollbar-thumb {
            background: rgb(255 255 255 / 0.3);
            border-radius: 8px;
        }
        .scrollbar-styled::-webkit-scrollbar-thumb:hover {
            background: rgb(255 255 255 / 0.5);
        }

        @media (pointer: coarse) {
            .scrollbar-styled {
                scrollbar-width: thick; /* Firefox */
                padding-inline-end: 12px;
            }
            .scrollbar-styled::-webkit-scrollbar {
                width: 18px;
                height: 18px;
            }
        }

        h1 {
            color: var(--secondary);
            text-align: center;
            padding-bottom: 20px;
        }

        h2 {
            color: var(--secondary);
            text-align: center;
            font-size: 1.3em;
            padding: 0;
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin: 0;
        }

        .header {
            display: flex;
            justify-content: center;
            align-items: center;

            background-color: var(--primary-darker);
            color: var(--text);
            width: 100%;

            height: 56px; /* Match show item height */
            font-weight: 600;
            font-size: 1.05em;
        }

        /* CHECKERED */

        .checkered {
            /* background-color: var(--transparent); */
            background: repeating-conic-gradient(rgba(70, 70, 80, 0.1) 0% 25%, transparent 0% 50%) 50% / 26px 26px;
        }
    </style>
</svelte:head>
