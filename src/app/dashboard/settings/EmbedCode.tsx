'use client'

import { useState } from 'react'

type EmbedTab = 'iframe' | 'button' | 'widget'

export default function EmbedCode({ slug }: { slug: string }) {
  const [activeTab, setActiveTab] = useState<EmbedTab>('iframe')
  const [copiedTab, setCopiedTab] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [color, setColor] = useState('#4ecde6')

  const baseUrl = 'https://theplayerportal.net'
  const embedUrl = `${baseUrl}/embed/${slug}${theme === 'dark' ? '?theme=dark' : ''}`
  const bookUrl = `${baseUrl}/book/${slug}`

  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;"></iframe>`

  const buttonCode = `<a href="${bookUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;border-radius:999px;font-size:16px;font-weight:700;background-color:${color};color:#fff;text-decoration:none;font-family:system-ui,sans-serif;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Book Now</a>`

  const widgetCode = `<script src="${baseUrl}/widget.js" data-slug="${slug}" data-color="${color}" data-position="bottom-right"></script>`

  const codes: Record<EmbedTab, string> = { iframe: iframeCode, button: buttonCode, widget: widgetCode }

  function copyCode(tab: EmbedTab) {
    navigator.clipboard.writeText(codes[tab])
    setCopiedTab(tab)
    setTimeout(() => setCopiedTab(null), 2000)
  }

  const tabs: { key: EmbedTab; label: string; description: string }[] = [
    { key: 'iframe', label: 'iFrame Embed', description: 'Embed your full class list directly on your website.' },
    { key: 'button', label: 'Book Now Button', description: 'A styled button that links to your booking page.' },
    { key: 'widget', label: 'Floating Widget', description: 'A floating button that appears on every page of your site.' },
  ]

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-6">
      <div>
        <h2 className="font-bold text-lg">Website Embed</h2>
        <p className="text-sm text-[#888] mt-1">Add booking to your own website. Copy the code and paste it into your site&apos;s HTML.</p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === t.key ? 'bg-primary text-white' : 'text-white/60 hover:bg-[#1e1e1e] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-[#888]">{tabs.find(t => t.key === activeTab)?.description}</p>

      {/* Options */}
      <div className="flex flex-wrap items-center gap-4">
        {activeTab === 'iframe' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-white/70">Theme</label>
            <select
              value={theme}
              onChange={e => setTheme(e.target.value as 'light' | 'dark')}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        )}
        {(activeTab === 'button' || activeTab === 'widget') && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-white/70">Button Colour</label>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer"
            />
            <input
              value={color}
              onChange={e => setColor(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white w-24 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        )}
      </div>

      {/* Code block */}
      <div className="relative">
        <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-4 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap break-all font-mono">
          {codes[activeTab]}
        </pre>
        <button
          onClick={() => copyCode(activeTab)}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          {copiedTab === activeTab ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Preview */}
      <div>
        <h3 className="text-sm font-semibold text-white/70 mb-3">Preview</h3>
        <div className="rounded-xl border border-[#2a2a2a] bg-white p-4 overflow-hidden">
          {activeTab === 'iframe' && (
            <iframe
              src={`/embed/${slug}${theme === 'dark' ? '?theme=dark' : ''}`}
              width="100%"
              height="400"
              style={{ border: 'none', borderRadius: 8 }}
              title="Embed preview"
            />
          )}
          {activeTab === 'button' && (
            <div className="flex justify-center py-6">
              <span
                style={{
                  display: 'inline-block',
                  padding: '14px 32px',
                  borderRadius: 999,
                  fontSize: 16,
                  fontWeight: 700,
                  backgroundColor: color,
                  color: '#fff',
                  fontFamily: 'system-ui, sans-serif',
                  cursor: 'pointer',
                }}
              >
                Book Now
              </span>
            </div>
          )}
          {activeTab === 'widget' && (
            <div className="relative h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
              <span>Your website content</span>
              <span
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  padding: '12px 24px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 700,
                  backgroundColor: color,
                  color: '#fff',
                  fontFamily: 'system-ui, sans-serif',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
              >
                Book Now
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
