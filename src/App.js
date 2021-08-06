import './App.css';
// import TopBar from './components/TopBar';
import Top from './components/Top';
import Preview from './components/Preview';
import Slides from './components/Slides';
import { createContext, useEffect, useState } from 'react';
import Editor from './components/Editor';
import Explorer from './components/Explorer';
import Timeline from './components/Timeline';
// import { useGlobalState } from './functions/GlobalState';



// let globalCount = new GlobalState(0);
// var settings = new useGlobalState({
//   format: 0,
//   resolution: [[1920, 1080]],
//   fontFamily: 'Tahoma'
// });
// const [settings, setSettings] = useState({
//   format: 0,
//   resolution: [[1920, 1080]],
//   fontFamily: 'Tahoma'
// });
var initialFreeShow = {
  settings: {
    format: 0,
    resolution: [[1920, 1080]],
    fontFamily: 'Tahoma',
    primaryColor: 'darkgray',
    secondaryColor: 'pink',
  },
  activeSong: 'Syng det ut',
  project: 0 // null...
}
export const Context = createContext();
export const values = {
  format: ['16:9', '4:3', '1:1'], // auto
  resolution: [[1920, 1080, 'Full HD']] // auto detect
}
// const project = 0;
// const [project, setProject] = useState(129);
export const projects = [
  {name: 'First', created: '23.07.2021', timeline: [{type: 'song', name: 'Nådepuls'}, {type: 'song', name: 'Syng det ut'}, {type: 'music', name: 'Test', location: '/'}, {type: 'video', name: 'Truth', location: 'C:/movies/'}]}
];
// const [projects, setProjects] = useState({
//   name: 'First',
//   songs: ['Nådepuls', 'Syng det ut']
// })
export const songs = {
  'Nådepuls': {
    project: {created: '23.07.2021'},
    meta: {title: 'Nådepuls', artist: 'test', license: 'CC'},
    slides: [[{text: [{content: 'Her er jeg Gud,\nmed mine byrder'}], style: {color: 'red', textAlign: 'center'}}]]
  },
  'Syng det ut': {
    meta: {title: 'Syng det ut', artist: 'test', license: 'CC'},
    slides: [[{text: [{content: 'Jesus det evige navn\nSom ingen utslette ', style: {fontFamily: 'Tahoma'}}, {content: 'kan', style: {color: 'red'}}], style: {top: 0, left: 200, height: 220, width: 900, textAlign: 'center'}}, {text: [{content: 'Impuls'}], style: {top: 0, left: 10, height: 80, width: 300}}], [{text: [{content: 'Andre linje', tag: 'p', style: {color: 'red', textAlign: 'center'}}]}]]
  }
}
const loadedSongs = {};
// WIP load timeline
projects[initialFreeShow.project].timeline.forEach(item => {
  if (item.type === 'song') loadedSongs[item.name] = songs[item.name];
  // else if (item.type === 'video')
})
console.log(loadedSongs);
initialFreeShow = {...initialFreeShow, songs: loadedSongs};
// WIP: , fontFamily: freeShow.settings.fontFamily

// TODO: context menu
// TODO: keyboard shortcuts
// TODO: auto next slide
// TODO: delete slides
// TODO: quick edit (for chagning spellig mistakes in the middle of a song)
// TODO: arrangments! (label verse, chorus + auto label?) + make unique
// TODO: textbox right click actions (move forward / backwards (zindex))


function App() {
  const [mode, setMode] = useState('live');
  // const [count, setCount] = useGlobalState(globalCount);
  const [freeShow, setFreeShow] = useState(initialFreeShow);
  const [mouse, setMouse] = useState({pos: {x: 0, y: 0}, secondPos: {x: 0, y: 0}, down: false});
  const [live, setLive] = useState(0);

  // TODO: stop mouse down if window loses focus!

  // useEffect(() => {
  //   console.log(mode)
  // }, [mode])

  return (
    <Context.Provider value={[freeShow, setFreeShow]}>
      <div className="App noselect"
        onMouseMove={e => { if (mouse.down) setMouse({...mouse, pos: {x: e.clientX, y: e.clientY}, movePos: {x: mouse.pos.x + e.movementX, y: mouse.pos.y + e.movementY}, secondPos: {x: mouse.pos.x - e.clientX, y: mouse.pos.y - e.clientY}}) }}
        onMouseUp={() => setMouse({...mouse, down: false})}
        onMouseDown={e => setMouse({...mouse, down: true, e: e, pos: {x: e.clientX, y: e.clientY}})} // , secondPos: {x: 0, y: 0}
      >
        {/* <TopBar /> */}
        <Top mode={mode} setMode={setMode} />
        {/* TODO: live has to be a duplicate of active slide, to prevent real updates. (settings to enable real updates?) */}
        {/* WIP transitions: queue, timings */}
        {mode === 'live' && <div style={{display: 'flex'}}>
          <Timeline />
          <Slides live={live} setLive={setLive} />
          <Preview live={live} setLive={setLive} />
        </div>}
        {mode === 'edit' && <Editor mouse={mouse} />}
        <Explorer mouse={mouse} />
      </div>
    </Context.Provider>
  );
}

export default App;
