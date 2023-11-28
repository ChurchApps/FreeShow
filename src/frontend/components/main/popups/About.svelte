<script lang="ts">
    import { version } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Link from "../../inputs/Link.svelte"

    const assets: { [key: string]: string } = {
        "CMG Sans (Custom font)": "https://www.churchmotiongraphics.com/cmg-sans/",
        "Google Fonts (Icons)": "https://fonts.google.com/icons",
        "Icons8 (Icons)": "https://icons8.com",
        "Pixabay (Web Images)": "https://pixabay.com/",
        "Electron (Cross-platform desktop apps)": "https://www.electronjs.org/",
        "Svelte (DOM framework)": "https://svelte.dev/",
        "Rollup (Module bundler)": "https://rollupjs.org/",
        "Socket.io (LAN connections)": "https://socket.io/",
        "Express (Web framework)": "https://expressjs.com/",
        "NDI® SDK (IP-streaming)": "https://ndi.video/",
    }
</script>

<div style="text-align: center;">
    <h1>FreeShow</h1>

    <p>
        <span style="opacity: 0.8;">v{$version} -</span>
        <Link url={"https://freeshow.app/?v" + $version}>
            <T id="about.check_updates" />
        </Link>
    </p>

    <!-- <p>
        <Link url="https://churchapps.org/">ChurchApps</Link>
    </p> -->
</div>

<br />

<div class="main">
    <div><T id="about.made" /> Kristoffer Vassbø</div>
    <div><T id="about.report" /></div>
    <div>
        <T id="about.help" />
        <Link url="mailto:dev@freeshow.app">dev@freeshow.app</Link>
    </div>
    <div>
        <T id="about.support" />
        <Link url="https://livecs.org/partner">https://livecs.org/partner</Link>
    </div>

    <br />

    <div>
        <h5><T id="about.assets" /></h5>

        {#each Object.entries(assets) as [asset, url]}
            <div style="display: flex;justify-content: space-between;gap: 10px;">
                <span>● {asset}</span>
                <span>
                    <Link {url}>{url}</Link>
                </span>
            </div>
        {/each}
    </div>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    h5 {
        color: var(--text);
        text-transform: uppercase;
        font-size: 0.9em;
        margin-bottom: 5px;
    }
</style>
