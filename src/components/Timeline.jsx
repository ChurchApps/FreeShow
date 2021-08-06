import { useContext, useState } from "react";
import { Context, projects } from "../App";

export default function Timeline({props}) {
  const [freeShow, setFreeShow] = useContext(Context);

  const [project, setProject] = useState(() => isNaN(freeShow.project) ? true : false);
  const style = {
    width: 200,
    height: '100%'
  }
  const list = {
    display: 'flex',
    flexDirection: 'column'
  }
  const listItem = {
    padding: '10px',
    fontSize: '0.9em',
    textAlign: 'left'
  }

  // console.log(projects);
  // projects.forEach((obj, i) => console.log(obj))
  // projects[freeShow.project].timeline.forEach((obj, i) => console.log(obj))

  return (
    <div style={style}>
      <span>
        <button onClick={() => setProject(true)} style={{width: '50%', backgroundColor: (project ? 'transparent' : 'rgb(0 0 0 / .2)'), color: (project ? 'var(--secondary)' : 'white')}}>Projects</button>
        <button onClick={() => setProject(false)} style={{width: '50%', backgroundColor: (project ? 'rgb(0 0 0 / .2)' : 'transparent'), color: (project ? 'white' : 'var(--secondary)')}}>Timeline</button>
      </span>
      {project ? <div style={list}>
        {projects.map((obj, i) => <button style={{...listItem, backgroundColor: (freeShow.project === i ? 'var(--secondary)' : '')}} onClick={() => setFreeShow({...freeShow, project: i})}>{obj.name}</button>)}
      </div> :
      <div style={list}>
        {projects[freeShow.project].timeline.map(obj => <button style={{...listItem, backgroundColor: (freeShow.activeSong === obj.name ? 'var(--secondary)' : '')}} class={obj.type} onClick={() => setFreeShow({...freeShow, activeSong: obj.name})}>{obj.name}</button>)}
      </div>}
    </div>
  );
}