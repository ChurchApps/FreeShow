<script>
	// import { dictionary, language, theme } from "./stores";
	import T from "./components/helpers/T.svelte";
	import Settings from "./components/Settings.svelte";
	import Top from "./components/views/Top.svelte";
	import Projects from "./components/views/Projects.svelte";
	import Show from "./components/views/Show.svelte";
	import Editor from "./components/views/Editor.svelte";
	import Preview from "./components/views/Preview.svelte";
	import FakeMonitor from "./components/views/FakeMonitor.svelte";

	// LANGUAGE
	// https://lokalise.com/blog/svelte-i18n/
	import { setLanguage, dir, translate } from './services/language'; // , language
  //  $: { document.dir = $dir; }
	setLanguage();
	// let d = {};
	// dictionary.subscribe(dict => d = dict);

	// TODO: update send to lan remote on active show/slide update

	// LISTEN TO MESSAGES FROM CLIENT/ELECTRON
	import { listen } from "./services/messages";
	listen();


	let activeFilePath;

	let settings = false;

	import VideoStream from "./components/controllers/VideoStream.svelte";


	let mode = 'live';
</script>

<main>
	<h1>FreeShow</h1>

	<button on:click={() => settings = !settings}>
		<T id="menus.settings" />
		<!-- {translate('menus.settings', $language)} -->
		<!-- {translate(d.menus?.settings)} -->
	</button>
	{#if settings}<Settings />{/if}



	
	<!-- {contextMenu && <ContextMenu event={contextMenu} setAction={setAction} />} -->
	<Top bind:mode />
	<div style="display: flex;">
		{#if mode === 'live'}
			<!-- All / Current/active -->
				<Projects />
				<Show />
			<!-- <Slides live={live} setLive={setLive} />
						<Preview live={live} setLive={setLive} /> -->
		{:else if mode === 'edit'}
			<Editor />
		{:else if mode === 'stage'}
				stage
		{/if}
		<!-- <Explorer mouse={mouse} request={request} /> -->

		<Preview {mode} />
	</div>

	<FakeMonitor />




	<!-- <VideoPlayer {activeFilePath} /> -->

	<!-- <video>
		<track kind="captions">
	</video> -->

	<!-- <VideoStream /> -->

	<!-- <p class="file-path">
    {activeFilePath ? activeFilePath : "Press 'Save' or hit 'CTRL + S' to save"}
  </p>

	<div class="editor-and-preview">
    <Editor bind:markdown />
    <Preview {markdown} />
  </div> -->
</main>

<style>
	/* main {
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	} */

	/* h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	} */
</style>