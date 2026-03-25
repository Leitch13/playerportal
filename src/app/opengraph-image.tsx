import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Player Portal — The All-in-One Platform for Football Academies'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #0f172a 50%, #0a0a0a 100%)',
        fontFamily: 'system-ui',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #4ecde6, #2ba8c3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '24px',
            fontWeight: 800,
          }}>
            PP
          </div>
          <span style={{ color: 'white', fontSize: '32px', fontWeight: 700 }}>
            Player Portal
          </span>
        </div>
        <h1 style={{
          color: 'white',
          fontSize: '56px',
          fontWeight: 800,
          textAlign: 'center',
          lineHeight: 1.1,
          margin: 0,
          maxWidth: '800px',
        }}>
          Run your academy
          <br />
          <span style={{ color: '#4ecde6' }}>like a pro</span>
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '24px',
          marginTop: '16px',
          textAlign: 'center',
        }}>
          Players. Progress. Payments. Parents.
        </p>
      </div>
    ),
    { ...size }
  )
}
