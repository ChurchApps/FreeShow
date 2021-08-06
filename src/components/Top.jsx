export default function Top({setMode, mode}) {
  return (
    <div style={{boxShadow: '2px 2px 4px 0 rgb(0 0 0 / 40%)', zIndex: 9999, padding: '10px'}}>
      <button title="Switch to live view" style={(mode === 'live' ? {color: 'var(--secondary)'} : {})} onClick={() => setMode('live')}>Live</button>
      <button title="Go to editor" style={(mode === 'edit' ? {color: 'var(--secondary)'} : {})} onClick={() => setMode('edit')}>Edit</button>
      {/* <button>X</button> */}

      <span style={{position: 'absolute', right: 10}}>
        <button>Settings</button>
        <button>About</button>
      </span>
    </div>
  );
}