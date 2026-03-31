'use client'

import { useState, useMemo } from 'react'
import { calculateEngagementScore } from '@/components/EngagementScore'

interface ParentData {
  id: string
  name: string
  email: string
  attendanceRate: number
  currentStreak: number
  paymentStatus: 'current' | 'overdue' | 'none'
  referralCount: number
  profileComplete: boolean
  totalSessions: number
}

interface AdminEngagementProps {
  parents: ParentData[]
  orgName: string
}

type Level = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

function getLevel(score: number): { level: Level; color: string; bgColor: string; emoji: string } {
  if (score >= 81) return { level: 'Platinum', color: 'text-cyan-300', bgColor: 'bg-cyan-500/10', emoji: '💎' }
  if (score >= 61) return { level: 'Gold', color: 'text-amber-400', bgColor: 'bg-amber-500/10', emoji: '🥇' }
  if (score >= 41) return { level: 'Silver', color: 'text-gray-300', bgColor: 'bg-gray-400/10', emoji: '🥈' }
  return { level: 'Bronze', color: 'text-orange-400', bgColor: 'bg-orange-500/10', emoji: '🥉' }
}

export default function AdminEngagement({ parents, orgName }: AdminEngagementProps) {
  const [sortBy, setSortBy] = useState<'score_asc' | 'score_desc' | 'name'>('score_asc')
  const [filter, setFilter] = useState<'all' | 'at_risk' | Level>('all')

  const parentScores = useMemo(() => {
    return parents.map(p => ({
      ...p,
      score: calculateEngagementScore(p),
    }))
  }, [parents])

  const filteredParents = useMemo(() => {
    let list = [...parentScores]

    // Filter
    if (filter === 'at_risk') {
      list = list.filter(p => p.score < 40 || p.paymentStatus === 'overdue')
    } else if (filter !== 'all') {
      list = list.filter(p => getLevel(p.score).level === filter)
    }

    // Sort
    if (sortBy === 'score_asc') list.sort((a, b) => a.score - b.score)
    else if (sortBy === 'score_desc') list.sort((a, b) => b.score - a.score)
    else list.sort((a, b) => a.name.localeCompare(b.name))

    return list
  }, [parentScores, sortBy, filter])

  // Stats
  const avgScore = parentScores.length > 0 ? Math.round(parentScores.reduce((s, p) => s + p.score, 0) / parentScores.length) : 0
  const distribution = {
    Platinum: parentScores.filter(p => p.score >= 81).length,
    Gold: parentScores.filter(p => p.score >= 61 && p.score < 81).length,
    Silver: parentScores.filter(p => p.score >= 41 && p.score < 61).length,
    Bronze: parentScores.filter(p => p.score < 41).length,
  }
  const atRiskCount = parentScores.filter(p => p.score < 40 || p.paymentStatus === 'overdue').length
  const maxDistribution = Math.max(...Object.values(distribution), 1)

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Parent Engagement</h1>
          <p className="text-sm text-white/40 mt-1">Monitor parent engagement scores across your academy</p>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4">
            <p className="text-xs text-white/40 font-medium">Total Parents</p>
            <p className="text-2xl font-bold text-[#4ecde6] mt-1">{parentScores.length}</p>
          </div>
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4">
            <p className="text-xs text-white/40 font-medium">Average Score</p>
            <p className="text-2xl font-bold text-white mt-1">{avgScore}</p>
            <p className="text-[10px] text-white/30">out of 100</p>
          </div>
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4">
            <p className="text-xs text-white/40 font-medium">Avg Level</p>
            <p className={`text-2xl font-bold mt-1 ${getLevel(avgScore).color}`}>{getLevel(avgScore).emoji} {getLevel(avgScore).level}</p>
          </div>
          <button
            onClick={() => setFilter('at_risk')}
            className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4 text-left hover:border-red-500/30 transition-colors"
          >
            <p className="text-xs text-white/40 font-medium">At Risk</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{atRiskCount}</p>
            <p className="text-[10px] text-white/30">parents needing attention</p>
          </button>
        </div>

        {/* Score distribution chart */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-4">Score Distribution</h2>
          <div className="space-y-3">
            {([
              { level: 'Platinum' as Level, count: distribution.Platinum, color: '#06b6d4' },
              { level: 'Gold' as Level, count: distribution.Gold, color: '#f59e0b' },
              { level: 'Silver' as Level, count: distribution.Silver, color: '#9ca3af' },
              { level: 'Bronze' as Level, count: distribution.Bronze, color: '#f97316' },
            ]).map(item => (
              <button
                key={item.level}
                onClick={() => setFilter(filter === item.level ? 'all' : item.level)}
                className={`w-full text-left ${filter === item.level ? 'opacity-100' : 'opacity-70 hover:opacity-100'} transition-opacity`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/60">{getLevel(item.level === 'Platinum' ? 81 : item.level === 'Gold' ? 61 : item.level === 'Silver' ? 41 : 0).emoji} {item.level}</span>
                  <span className="text-sm font-bold text-white">{item.count}</span>
                </div>
                <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(item.count / maxDistribution) * 100}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-[#4ecde6]/40"
          >
            <option value="score_asc">Score: Low to High</option>
            <option value="score_desc">Score: High to Low</option>
            <option value="name">Name: A-Z</option>
          </select>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-[#4ecde6]/40"
          >
            <option value="all">All Parents</option>
            <option value="at_risk">At Risk</option>
            <option value="Platinum">Platinum</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Bronze">Bronze</option>
          </select>

          <span className="text-xs text-white/30 ml-auto">{filteredParents.length} parent{filteredParents.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Parents table */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Parent</th>
                  <th className="text-center text-xs text-white/40 font-medium px-3 py-3">Score</th>
                  <th className="text-center text-xs text-white/40 font-medium px-3 py-3 hidden sm:table-cell">Level</th>
                  <th className="text-center text-xs text-white/40 font-medium px-3 py-3 hidden md:table-cell">Attendance</th>
                  <th className="text-center text-xs text-white/40 font-medium px-3 py-3 hidden md:table-cell">Streak</th>
                  <th className="text-center text-xs text-white/40 font-medium px-3 py-3 hidden lg:table-cell">Payment</th>
                  <th className="text-center text-xs text-white/40 font-medium px-3 py-3 hidden lg:table-cell">Referrals</th>
                </tr>
              </thead>
              <tbody>
                {filteredParents.map((p) => {
                  const lvl = getLevel(p.score)
                  const isAtRisk = p.score < 40 || p.paymentStatus === 'overdue'
                  return (
                    <tr key={p.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${isAtRisk ? 'bg-red-500/[0.03]' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{p.name}</p>
                          <p className="text-[10px] text-white/30">{p.email}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2" style={{ borderColor: lvl.level === 'Platinum' ? '#06b6d4' : lvl.level === 'Gold' ? '#f59e0b' : lvl.level === 'Silver' ? '#9ca3af' : '#f97316' }}>
                          <span className={`text-sm font-bold ${lvl.color}`}>{p.score}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${lvl.bgColor} ${lvl.color}`}>
                          {lvl.emoji} {lvl.level}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center hidden md:table-cell">
                        <span className={`text-sm font-medium ${p.attendanceRate >= 80 ? 'text-emerald-400' : p.attendanceRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.attendanceRate}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center hidden md:table-cell">
                        <span className="text-sm text-white/60">{p.currentStreak}</span>
                      </td>
                      <td className="px-3 py-3 text-center hidden lg:table-cell">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.paymentStatus === 'current' ? 'bg-emerald-500/10 text-emerald-400' :
                          p.paymentStatus === 'overdue' ? 'bg-red-500/10 text-red-400' :
                          'bg-white/[0.06] text-white/40'
                        }`}>
                          {p.paymentStatus === 'current' ? 'Current' : p.paymentStatus === 'overdue' ? 'Overdue' : 'None'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center hidden lg:table-cell">
                        <span className="text-sm text-white/60">{p.referralCount}</span>
                      </td>
                    </tr>
                  )
                })}
                {filteredParents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-white/30">
                      No parents found matching the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* At-risk parents highlight */}
        {atRiskCount > 0 && filter !== 'at_risk' && (
          <div className="bg-red-500/[0.06] border border-red-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-red-400">{atRiskCount} Parent{atRiskCount !== 1 ? 's' : ''} at Risk</p>
                <p className="text-xs text-red-400/60 mt-1">These parents have low engagement scores or overdue payments. Consider reaching out.</p>
                <button
                  onClick={() => setFilter('at_risk')}
                  className="mt-3 text-xs font-medium text-red-400 hover:underline"
                >
                  View at-risk parents &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
