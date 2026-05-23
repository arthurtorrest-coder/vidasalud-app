import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function VideoRoom({ url, onLeave }) {
  const iframeRef  = useRef(null)
  const onLeaveRef = useRef(onLeave)

  useEffect(() => { onLeaveRef.current = onLeave })

  useEffect(() => {
    document.body.style.overflow = 'hidden'

    function handleMessage(e) {
      if (e.data?.type === 'VIDASALUD_LEAVE') onLeaveRef.current?.()
    }
    window.addEventListener('message', handleMessage)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('message', handleMessage)
      if (iframeRef.current) iframeRef.current.src = ''
    }
  }, [])

  return createPortal(
    <iframe
      ref={iframeRef}
      src={`/videollamada.html?url=${encodeURIComponent(url)}`}
      allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
      allowFullScreen
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        border: 'none', zIndex: 9999,
      }}
    />,
    document.body
  )
}
