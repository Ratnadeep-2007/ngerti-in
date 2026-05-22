import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useIsMobile } from './use-mobile'

describe('useIsMobile', () => {
  beforeEach(() => {
    // Reset window and matchMedia mocks
    vi.stubGlobal('innerWidth', 1024)
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
  })

  it('returns false for desktop width', () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true for mobile width', () => {
    vi.stubGlobal('innerWidth', 375)
    // We need to trigger the effect which checks innerWidth
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })
})
