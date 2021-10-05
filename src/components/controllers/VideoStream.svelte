<!-- https://www.youtube.com/watch?v=3yqDxhR2XxE -->
<!-- https://www.electronjs.org/docs/api/desktop-capturer -->

<script>
  import Dropdown from "../inputs/Dropdown.svelte";


  let screens = [];
	window.api.send(GET_SCREENS, {});
	window.api.receive(GET_SCREENS, (data) => {
		console.log('Screen:', data);
		screens = data;
	});

	let streamSource = null;
	$: streamSource, getStream(streamSource);
	// let activeStream;
	let streamElement;

	async function getStream(data) {
		if (data) {
			const constraints = {
				audio: false,
				video: {
					mandatory: {
						chromeMediaSource: 'desktop',
						chromeMediaSourceId: data.id,
						maxWidth: 1920,
						maxHeight: 1080,
						// maxAspectRatio: 16/9,
						maxFrameRate: 60
					},
					// CAMERA!
					// width: { min: 1024, ideal: 1280, max: 1920 },
					// height: { min: 576, ideal: 720, max: 1080 }
					// width: { min: 640, ideal: 1920, max: 1920 },
					// height: { min: 400, ideal: 1080 },
					// aspectRatio: 1.777777778,
					// frameRate: { max: 30 },
					// facingMode: { exact: "user" }
				}
			};
	
			const stream = await navigator.mediaDevices.getUserMedia(constraints).then(function(mediaStream) {
				// console.log(mediaStream);
				// activeStream = mediaStream;
				// var video = document.querySelectorAll('video')[1];
				streamElement.srcObject = mediaStream;
				streamElement.onloadedmetadata = function(e) {
					streamElement.play();
				};
			}).catch(function(err) {
				console.log(err.name + ": " + err.message);
			});
		}
	}
</script>

<video bind:this={streamElement} on:click={e => e.target.play()}>
  <track kind="captions">
</video>

<button>Start</button>
<button>Stop</button>

<Dropdown value={streamSource?.name} options={screens} on:click={e => streamSource = e.detail} />

<style>
  video {
    background-color: black;
    width: 100%;
  }
</style>