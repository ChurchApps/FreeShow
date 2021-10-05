import { get } from "svelte/store";
import { activeSlide, shows, name, activeShow, language, activeProject, projects, folders } from "../stores";
import { STAGE, LAN, MAIN, OPEN_FILE } from "../values/channels";

export function listen() {
  if (get(name) === null) window.api.send(MAIN, 'getOS');
  // FROM ELECTRON
	window.api.receive(MAIN, (data) => {
		if (data.id === 'os' && get(name) === null) name.set(data.data);
	});

	window.api.receive(OPEN_FILE, (data) => {
		console.log(data);
		// activeFilePath = data.path;
		activeFilePath = data;
	});
	// window.api.send(OPEN_FILE, {path: 'C:/Users/Kristoffer/Coding/FreeShow/sources.txt'});
	// window.api.send(OPEN_FILE, 'C:/Users/Kristoffer/Coding/FreeShow/sources.txt');
	// window.api.send(OPEN_FILE, {});


  // FROM CLIENT
  window.api.receive(LAN, (data) => {
		if (data.action === 'request') {
			window.api.send(LAN, {id: data.id, channel: 'data', data: {name: get(name), lang: get(language), activeShow: get(activeShow), activeProject: get(activeProject), projects: get(projects), folders: get(folders)}}); // songs: ['test', 'test2', 'Frihet']
		} else if (data.action === 'getShow') {
			// if type !== X
			console.log(data);
			window.api.send(LAN, {id: data.id, channel: 'show', data: get(shows)[data.data.id]});
		} else {
			console.log('LAN: ', data.id ? data.id + ': ' + data.data : data);
		}
	});


  // TO STAGE
  activeSlide.subscribe((slide) => {
    if (slide !== null) {
      if (slide.type === 'video...') {
      } else {
        window.api.send(STAGE, get(shows)[slide.id].slides[slide.index]);
        // TODO: send next slide + countdown + others... / messages
      }
    } else window.api.send(STAGE, null);
  });

  // FROM STAGE
	window.api.receive(STAGE, (data) => {
    let as = get(activeSlide);
		if (data === 'request' && as !== null) {
			window.api.send(STAGE, get(shows)[as.id].slides[as.index]);
		}
	});
}