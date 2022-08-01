<script lang="ts">
  import { READ_FOLDER } from "../../../../types/Channels"
  import { audioExtensions, audioFolders, dictionary, media, playingAudio } from "../../../stores"
  import { getAudioDuration, playAudio } from "../../helpers/audio"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import { joinTime, secondsToTime } from "../../helpers/time"
  import Button from "../../inputs/Button.svelte"
  import Center from "../../system/Center.svelte"
  import SelectElem from "../../system/SelectElem.svelte"
  import Folder from "../media/Folder.svelte"

  export let active: string | null
  export let searchValue: string = ""

  let files: any[] = []
  let extensions: string[] = $audioExtensions
  let scrollElem: any

  $: rootPath = active === "all" || active === "favourites" ? "" : active !== null ? $audioFolders[active].path! : ""
  $: path = active === "all" || active === "favourites" ? "" : rootPath
  $: name =
    rootPath === path
      ? active !== "all" && active !== "favourites" && active !== null
        ? $audioFolders[active].name
        : "category.all"
      : path.substring((path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")) + 1)

  // get list of files & folders
  let prevActive: null | string = null
  $: {
    if (active === "favourites") {
      prevActive = active
      files = Object.entries($media)
        .map(([path, a]: any) => {
          let name = path.slice((path.lastIndexOf("\\") || path.lastIndexOf("//")) + 1, path.length)
          const extension = name.slice(name.lastIndexOf(".") + 1, name.length)
          return { path, favourite: a.favourite === true, name, extension, audio: a.audio === true }
        })
        .filter((a) => a.favourite === true && a.audio === true)

      // filterFiles()
      scrollElem?.scrollTo(0, 0)
    } else if (active === "all") {
      if (active !== prevActive) {
        prevActive = active
        files = []
        Object.values($audioFolders).forEach((data) => window.api.send(READ_FOLDER, data.path))
      }
    } else if (path.length) {
      if (path !== prevActive) {
        prevActive = path
        files = []
        window.api.send(READ_FOLDER, path)
      }
    }
  }

  // receive files
  window.api.receive(READ_FOLDER, (msg: any) => {
    if (active === "all" || msg.path === path) {
      files.push(...msg.files.filter((file: any) => extensions.includes(file.extension) || (active !== "all" && file.folder)))
      files.sort((a: any, b: any) => a.name.localeCompare(b.name)).sort((a: any, b: any) => (a.folder === b.folder ? 0 : a.folder ? -1 : 1))

      console.log(files)
      files = files

      // filterFiles()
      scrollElem?.scrollTo(0, 0)
    }
  })

  // search
  $: if (searchValue !== undefined || files) filterSearch()
  const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
  let fullFilteredFiles: any[] = []
  function filterSearch() {
    fullFilteredFiles = JSON.parse(JSON.stringify(files))
    if (searchValue.length > 1) fullFilteredFiles = fullFilteredFiles.filter((a) => filter(a.name).includes(searchValue))
  }

  function keydown(e: any) {
    // if (e.key === "Enter" && searchValue.length > 1 && e.target.closest(".search")) {
    //   if (fullFilteredFiles.length) {
    //     let file = fullFilteredFiles[0]
    //     activeShow.set({ id: file.path, name: file.name, type: $videoExtensions.includes(file.extension) ? "video" : "image" })
    //     activeFile = filteredFiles.findIndex((a) => a.path === file.path)
    //     if (activeFile < 0) activeFile = null
    //   }
    // }

    if (e.target.closest("input") || e.target.closest(".edit")) return

    if (e.ctrlKey && e.key === "Backspace") {
      if (rootPath === path) return
      goBack()
    }
  }

  function goBack() {
    const lastSlash = path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")
    const folder = path.slice(0, lastSlash)
    path = folder.length > rootPath.length ? folder : rootPath
  }

  // function playAudio(file: any) {
  //   if ($playingAudio[file.path]) {
  //     playingAudio.update((a) => {
  //       let paused = a[file.path].paused
  //       a[file.path].paused = !paused
  //       if (paused) a[file.path].audio.play()
  //       else a[file.path].audio.pause()
  //       return a
  //     })
  //     return
  //   }

  //   let audio = new Audio(file.path)
  //   playingAudio.update((a) => {
  //     a[file.path] = {
  //       name: file.name.slice(0, file.name.lastIndexOf(".")),
  //       paused: false,
  //       audio,
  //     }
  //     return a
  //   })

  //   audioSource.set(audio)
  //   analyse()
  //   audio.play()
  // }

  // ANALYSER
  // let analyser: any = null
  // let interval: any = null
  // $: if (analyser) startInterval()

  // function startInterval() {
  //   interval = setInterval(() => {
  //     audioChannels.set(audioAnalyser(analyser))
  //   }, 100)
  // }

  // async function analyse() {
  //   console.log(0)
  //   // https://stackoverflow.com/questions/20769261/how-to-get-video-elements-current-level-of-loudness
  //   let ac = new AudioContext()
  //   let source = ac.createMediaElementSource($audioSource)

  //   analyser = ac.createAnalyser() //we create an analyser
  //   analyser.smoothingTimeConstant = 0.9
  //   analyser.fftSize = 512 //the total samples are half the fft size.

  //   source.connect(analyser)
  //   analyser.connect(ac.destination)

  //   if (interval) clearInterval(interval)
  //   startInterval()
  // }
</script>

<svelte:window on:keydown={keydown} />

<div class="scroll" style="flex: 1;overflow-y: auto;" bind:this={scrollElem}>
  <div class="grid" style="height: 100%;">
    {#if fullFilteredFiles.length}
      {#key rootPath}
        {#key path}
          {#each fullFilteredFiles as file}
            {#if file.folder}
              <Folder bind:rootPath={path} name={file.name} path={file.path} mode="list" />
            {:else}
              <SelectElem id="audio" data={{ path: file.path, name: file.name }} draggable>
                <Button class="context #audio_button" outline={$playingAudio[file.path]} style="width: 100%;" title={file.path} bold={false} on:click={() => playAudio(file)}>
                  <span>
                    <Icon
                      id={$playingAudio[file.path]?.paused === true
                        ? "play"
                        : $playingAudio[file.path]?.paused === false
                        ? "pause"
                        : $media[file.path]?.favourite === true && active !== "favourites"
                        ? "star"
                        : "music"}
                      right
                    />
                    <p>{file.name.slice(0, file.name.lastIndexOf("."))}</p>
                  </span>
                  <span style="opacity: 0.8;">
                    {#await getAudioDuration(file.path)}
                      <p>00:00</p>
                    {:then duration}
                      <p>{joinTime(secondsToTime(duration))}</p>
                    {/await}
                  </span>
                </Button>
              </SelectElem>
            {/if}
          {/each}
        {/key}
      {/key}
    {:else}
      <Center>
        <Icon id="noAudio" size={5} white />
      </Center>
    {/if}
  </div>
</div>

<div class="tabs" style="display: flex;align-items: center;">
  <Button disabled={rootPath === path} title={$dictionary.actions?.back} on:click={goBack}>
    <Icon size={1.3} id="back" />
  </Button>
  <Button disabled={rootPath === path} title={$dictionary.actions?.home} on:click={() => (path = rootPath)}>
    <Icon size={1.3} id="home" />
  </Button>
  <span style="flex: 1;text-align: center;">
    {#key name}
      {#if name.includes(".")}
        <T id={name} />
      {:else}
        {name}
      {/if}
    {/key}
  </span>
</div>

<style>
  .tabs {
    display: flex;
    background-color: var(--primary-darkest);
  }

  .grid {
    display: flex;
    flex-direction: column;
    /* flex-wrap: wrap; */
    flex: 1;
    /* gap: 10px;
    padding: 10px; */
    /* padding: 5px; */
    place-content: flex-start;
  }

  .grid :global(button) {
    /* font-size: 1em; */
    padding: 8px 15px;

    justify-content: space-between;
  }
  .grid span {
    display: flex;
    gap: 5px;
  }
</style>
