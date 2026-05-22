import { describe, it, expect } from 'vitest'
import { cn, formatDuration } from './utils'

describe('cn utility', () => {
  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-2', 'px-4')).toBe('py-2 px-4')
  })

  it('handles conditional classes', () => {
    expect(cn('px-2', true && 'py-2', false && 'm-2')).toBe('px-2 py-2')
  })
})

describe('formatDuration utility', () => {
  it('formats seconds correctly', () => {
    expect(formatDuration(60)).toBe('1m')
    expect(formatDuration(3661)).toBe('1h 1m 1s')
  })

  it('converts milliseconds to seconds if value is large', () => {
    // 120000ms = 120s = 2m
    expect(formatDuration(120000)).toBe('2m')
  })
})
