import { writable } from 'svelte/store';

// export const theme = writable({
//   primary: '#2d313b',
//   secondary: '#e6349c',
//   textPrimary: '#f0f0ff',
//   textInvert: '#131313',
// });

// global events
// export const click = writable(null);

export const projectView = writable(false);
export const openedFolders = writable(["feriwp", "ffskof"]);

// project
export const activeProject = writable('feskof'); // id
export const activeShow = writable(null); // id, type
// output = [] // video/image, audio, text, overlay
// Layers: background, text, overlay, audio
export const activeSlide = writable(null); // id, index, type ...
// export const activeOverlay = writable(null); // id, index ...
// https://stackoverflow.com/a/14869745
// var id = crypto.randomBytes(10).toString('hex'); (check for existing...)
// start on 0 and count upwards?
export const shows = writable({
  nåde: {
    show: {name: 'Nådepuls', created: '25.07.2021', category: 'Songs'}, // song/private/notes/presentation
    meta: {title: 'Nådepuls', artist: 'test', license: 'CC'},
    slides: [[{content: [{text: 'Her er jeg Gud,\nmed mine byrder'}], style: {color: 'red', textAlign: 'center'}}]]
  },
  'Syng det ut': {
    show: {name: 'Syng det ut', created: '25.07.2021', category: 'Songs'},
    meta: {title: 'Syng det ut', artist: 'test', license: 'CC'},
    slides: [[{content: [{text: 'Jesus det evige navn\nSom ingen utslette ', style: "font-family: Tahoma;"}, {text: 'kan', style: "color: red;"}], style: "top: 0px; left: 200px; height: 220px; width: 900px; text-align: center;"}, {content: [{text: 'Impuls'}], style: "top: 0px; left: 10px; height: 80px; width: 300px;"}], [{content: [{text: 'Andre linje', tag: 'p', style: "color: red; text-align: center;"}]}]]
  },
  'Info': { // TODO: how to tdo info... in a better way
    show: {name: 'Info', created: '09.08.2021', category: 'Info'},
    // meta: {title: 'Info'},
    slides: [[{content: [{text: 'Velkommen!', style: {fontSize: '180px', fontWeight: 'bold', fontFamily: 'Tahoma'}}], style: {top: 400, left: 180, height: 220, width: 1500, textAlign: 'center'}, transition: ['default', 5], background: 'image/video...'}, {content: [{text: 'Impuls'}], style: {top: 0, left: 10, height: 80, width: 300}}], [{content: [{text: 'Andre linje', tag: 'p', style: {color: 'red', textAlign: 'center'}}]}]]
  },
  gere: {
    show: {name: 'Info', created: '09.08.2021', category: 'Info'},
    // meta: {title: 'Info'},
    slides: [[{content: [{text: 'Velkommen!', style: {fontSize: '180px', fontWeight: 'bold', fontFamily: 'Tahoma'}}], style: {top: 400, left: 180, height: 220, width: 1500, textAlign: 'center'}, transition: ['default', 5], background: 'image/video...'}, {content: [{text: 'Impuls'}], style: {top: 0, left: 10, height: 80, width: 300}}], [{content: [{text: 'Andre linje', tag: 'p', style: {color: 'red', textAlign: 'center'}}]}]]
  }
});
export const projects = writable({
  fhsjoe: {name: 'First', created: '25.07.2021', path: '/', parent: '/', shows: [{id: 'nåde'}, {id: 'Syng det ut'}, {id: 'Info', location: '/'}, {id: 'nåde'}, {type: 'video', id: 'Truth', location: 'C:/movies/'}]},
  feskof: {name: 'Meeting', created: '06.08.2021', path: '/ffskof/feriwp', parent: 'feriwp', shows: [{id: 'Syng det ut'}, {id: 'nåde'}, {type: 'private', access: 'Private', id: 'gere'}]}
});
// export const projects = writable([
//   {name: 'First', created: '25.07.2021', shows: [{id: 'nåde'}, {id: 'Syng det ut'}, {id: 'Info', location: '/'}, {type: 'video', id: 'Truth', location: 'C:/movies/'}]},
//   {name: 'test', folder: [
//     {name: 'Meeting', created: '06.08.2021', shows: [{id: 'Syng det ut'}, {id: 'nåde'}, {type: 'private', access: 'Private', id: 'Info'}]}
//   ]},
//   {name: 'Nest', folder: [
//     {name: 'Ayy', folder: []}
//   ]}
// ]);
export const folders = writable({
  esf1: {name: 'Ayy1', path: '/fese', parent: 'fese'},
  ffskof: {name: 'Name', path: '/', parent: '/'},
  // fes: {name: 'Non existant', path: 'es3333f', parent: 'es3333f'},
  feriwp: {name: 'Second', path: '/ffskof', parent: 'ffskof'},
  esf: {name: 'Ayy', path: '/fese', parent: 'fese'},
  esf3: {name: 'Ayy3', path: '/fese', parent: 'fese'},
  fes3: {name: 'Test3', path: '/fese/esf/fes/fes2', parent: 'fes2'},
  fese: {name: 'Nest', path: '/', parent: '/'},
  fes2: {name: 'Test2', path: '/fese/esf/fes', parent: 'fes'},
  fes: {name: 'Test', path: '/fese/esf', parent: 'esf'},
  esf2: {name: 'Ayy2', path: '/fese', parent: 'fese'},
});


// SETTINGS
// lan
export const name = writable(null);
export const password = writable('show');

// general
export const language = writable('en');

// text
export const theme = writable(0);
export const font = writable({
  family: 'Tahoma',
  size: 12,
  color: 'white',
  outline: {width: 2, color: 'black'},
  shadow: {x: 2, y: 2, blur: 4, spread: 0, color: 'black'}
});
export const screen = writable({
  resolution: {width: 1920, height: 1080}
  // format 16:9
});

// empty
export const dictionary = writable({});
export const theme_css = writable({});