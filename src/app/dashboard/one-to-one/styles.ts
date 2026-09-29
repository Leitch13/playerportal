// Plain strings, safe for server pages. A constant exported from a 'use client' file
// reaches a server page as a client reference, not a string: `inputCls + ' x'` there
// rendered the function's source as the class, so those boxes had no style at all.
export const inputCls = 'w-full rounded-lg border border-white/[0.12] bg-[#080e18] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4ecde6] focus:outline-none'
