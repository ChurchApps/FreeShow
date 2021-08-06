export default function TopBar ({props}) {
  const style = {
    bar: {
      width: '100%',
      display: 'flex',
      height: '50px',
      backgroundColor: 'var(--primary)',
      color: 'var(--primary-text)'
    },
    right: {
      display: 'flex',
      position: 'absolute',
      height: 'inherit',
      right: 0
    },
    title: {
      lineHeight: 0,
      alignSelf: 'center'
    },
    button: {
      display: 'flex',
      height: 'inherit',
      padding: '0 10px',
      alignItems: 'center',
    }
  }

  return (
    <header style={style.bar}>
      <h1 style={style.title}>FreeShow</h1>
      <div style={style.right}>
        <div style={style.button}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M19 13H5v-2h14v2z"/></svg></div>
        <div style={style.button}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/></svg></div>
        <div style={style.button}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></div>
      </div>
    </header>
  );
}