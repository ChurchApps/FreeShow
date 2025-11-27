<script lang="ts">
    import { version } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Link from "../../inputs/Link.svelte"

    const assets: { [key: string]: string } = {
        "CMG Sans (Custom font)": "https://www.churchmotiongraphics.com/cmg-sans/",
        "Google Fonts (Icons)": "https://fonts.google.com/icons/",
        "Icons8 (Icons)": "https://icons8.com/",
        "Pixabay (Web Images)": "https://pixabay.com/",
        "Unsplash (Web Images)": "https://unsplash.com/",
        "Electron (Cross-platform desktop apps)": "https://www.electronjs.org/",
        "Svelte (DOM framework)": "https://svelte.dev/",
        "Rollup (Module bundler)": "https://rollupjs.org/",
        "Socket.io (LAN connections)": "https://socket.io/",
        "Express (Web framework)": "https://expressjs.com/",
        "NDI® SDK (IP-streaming)": "https://ndi.video/",
        "CAPTION.Ninja (Live captions)": "https://caption.ninja/",
        "Google Translate (Localization)": "https://translate.google.com/"
    }
</script>

<div style="text-align: center;">
    <div class="logo">
        <img style="height: 35px;" src="./import-logos/freeshow.webp" alt="FreeShow-logo" draggable={false} />
        <h1 style="color: var(--text);font-size: 1.7em;">FreeShow</h1>
    </div>

    <p style="font-size: 0.8em;margin-top: 2px;">
        <span style="opacity: 0.8;">v{$version} -</span>
        <Link url={"https://freeshow.app/?v" + $version}>
            <T id="about.check_updates" />
        </Link>
    </p>

    <!-- <p>
        <Link url="https://churchapps.org/">ChurchApps</Link>
    </p> -->
</div>

<hr />

<div class="main">
    <div class="text">
        <div>
            ● <T id="about.more" />
            <Link url="https://churchapps.org/">ChurchApps</Link>
        </div>
        <div>
            ● <T id="about.report" />
            <Link url="https://github.com/ChurchApps/FreeShow/issues">GitHub Issues</Link>
        </div>
        <div>
            ● <T id="about.translate" />
            <Link url="https://app.transifex.com/nettbiter/freeshow/">Transifex</Link>
        </div>
        <!-- <div>
            ● <T id="about.mail" />
            <Link url="mailto:dev@freeshow.app">dev@freeshow.app</Link>
        </div> -->
        <div>
            ● <T id="about.support" />!
            <Link url="https://churchapps.org/partner#give">churchapps.org/partner</Link>
        </div>
    </div>

    <hr />

    <div>
        <h5><T id="about.assets" /></h5>

        <div class="links">
            {#each Object.entries(assets) as [asset, url]}
                <span>• <Link {url}>{asset}</Link></span>
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
