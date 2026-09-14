<script lang="ts">
    import { activePopup, version } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Link from "../../inputs/Link.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const assets: { name: string; url: string; title?: string }[] = [
        { name: "CMG Sans (Custom font)", url: "https://www.churchmotiongraphics.com/cmg-sans/" },
        { name: "Google Fonts (Icons)", url: "https://fonts.google.com/icons/" },
        { name: "Icons8 (Icons)", url: "https://icons8.com/" },
        { name: "Pixabay (Web Images)", url: "https://pixabay.com/" },
        { name: "Unsplash (Web Images)", url: "https://unsplash.com/" },
        { name: "Electron (Cross-platform desktop apps)", url: "https://www.electronjs.org/" },
        { name: "Svelte (DOM framework)", url: "https://svelte.dev/" },
        { name: "Rollup (Module bundler)", url: "https://rollupjs.org/" },
        { name: "Socket.io (LAN connections)", url: "https://socket.io/" },
        { name: "Express (Web framework)", url: "https://expressjs.com/" },
        { name: "NDI® SDK (IP-streaming)", url: "https://ndi.video/", title: "NDI® is a registered trademark of Vizrt NDI AB." },
        { name: "Blackmagic Design® (Local output)", url: "https://www.blackmagicdesign.com/", title: "Blackmagic Design is a registered trademark of Blackmagic Design Pty. Ltd." },
        { name: "CAPTION.Ninja (Live captions)", url: "https://caption.ninja/" },
        { name: "Google Translate (Localization)", url: "https://translate.google.com/" }
    ]
</script>

<div style="text-align: center;">
    <div class="logo">
        <img style="height: 35px;" src="./import-logos/freeshow.webp" alt="FreeShow-logo" draggable={false} />
        <h1 style="color: var(--text);font-size: 1.7em;">FreeShow</h1>
    </div>

    <p style="font-size: 0.8em;margin-top: 2px;">
        <span style="opacity: 0.8;">v{$version}</span>
        <MaterialButton variant="outlined" style="margin-left: 5px;display: inline-flex;min-height: 0;padding: 0 5px;vertical-align: baseline;" on:click={() => activePopup.set("update_manager")} white>
            <T id="about.check_updates" />
        </MaterialButton>
    </p>

    <!-- <p>
        <Link url="https://churchapps.org/">ChurchApps</Link>
    </p> -->
</div>

<hr />

<div class="main">
    <div class="text">
        <div>
            • <T id="about.more" />
            <Link url="https://churchapps.org/">ChurchApps</Link>
        </div>
        <div>
            • <T id="about.report" />
            <Link url="https://github.com/ChurchApps/FreeShow/issues">GitHub Issues</Link>
        </div>
        <div>
            • <T id="about.translate" />
            <Link url="https://app.transifex.com/nettbiter/freeshow/">Transifex</Link>
        </div>
        <!-- <div>
            • <T id="about.mail" />
            <Link url="mailto:dev@freeshow.app">dev@freeshow.app</Link>
        </div> -->
        <div>
            • <T id="about.support" />!
            <Link url="https://churchapps.org/partner#give">churchapps.org/partner</Link>
        </div>
    </div>

    <hr />

    <div>
        <h5><T id="about.assets" /></h5>

        <div class="links">
            {#each assets as asset}
                <span data-title={asset.title}>• <Link url={asset.url}>{asset.name}</Link></span>
            {/each}
        </div>
    </div>

    <div style="text-align: center;font-size: 0.7em;opacity: 0.5;margin-top: 12px;"><T id="about.made" /> Kristoffer Vassbø (2021)</div>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .logo {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0px 10px;
        width: 100%;
        gap: 10px;
    }

    h5 {
        color: var(--text);
        text-transform: uppercase;
        font-size: 0.9em;
        margin-bottom: 5px;
    }

    hr {
        border: none;
        height: 2px;
        margin: 30px 0;
        background-color: var(--primary-lighter);
    }

    .links {
        display: flex;
        flex-direction: column;
        gap: 3px;

        font-size: 0.9em;
    }

    .links :global(a) {
        opacity: 0.9;
        text-decoration: none;
    }
</style>
