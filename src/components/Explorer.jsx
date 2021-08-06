import { useEffect, useState } from "react";

export default function Explorer({mouse}) {
  const [height, setHeight] = useState(100);
  // const limit = [50, 500];
  const limit = [50, window.innerHeight - window.innerHeight / 3];

  useEffect(() => {
    if (mouse.e?.target.id === 'explorer_resize' && mouse.down) {
      let newHeight = window.innerHeight - mouse.pos.y - mouse.secondPos.y;
      if (newHeight < limit[0]) newHeight = limit[0];
      else if (newHeight > limit[1]) newHeight = limit[1];
      setHeight(newHeight);
    }
  }, [mouse])

  return (
    <div style={{backgroundColor: 'var(--primary)', position: 'absolute', bottom: 0, width: '100%', height, boxShadow: '0 -4px 10px 0 rgb(0 0 0 / 20%)'}}>
      <div id='explorer_resize' style={{width: '100%', height: '4px', backgroundColor: 'var(--secondary)', position: 'absolute', top: -4, cursor: 'n-resize'}}></div>
      {/* <div style={{width: '100%', height: '2px', backgroundColor: 'red', position: 'absolute', top: -2}}></div> */}
      <div id="explorer">
        Explorer
      </div>
    </div>
  );
}