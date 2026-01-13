
export default function Controls({ currentSrc, setCurrentSrc }) {
  const buttons = [
    { id: 'youtube', label: 'YouTube', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ' },
    { id: 'spotify', label: 'Spotify', src: 'https://open.spotify.com/embed/playlist/37i9dQZEVXcZb9ak6F5ysH?utm_source=generator' },
    { id: 'ssh', label: 'SSH', src: 'https://ssh.adnaan.me' }
  ]

  return (
    <div className="controls">
      {buttons.map(b => (
        <button
          key={b.id}
          className={b.src === currentSrc ? 'active' : ''}
          onClick={() => setCurrentSrc(b.src)}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}
