import DailyIframe from '@daily-co/daily-js'

export function createDailyFrame(container, options = {}) {
  return DailyIframe.createFrame(container, {
    showLeaveButton: true,
    showFullscreenButton: true,
    iframeStyle: {
      width: '100%',
      height: '100%',
      border: 'none',
      borderRadius: '16px',
    },
    ...options,
  })
}

export function formatRoomUrl(domain, roomName) {
  return `https://${domain}.daily.co/${roomName}`
}
