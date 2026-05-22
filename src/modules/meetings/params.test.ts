import { describe, it, expect } from 'vitest'
import { filtersSearcheParams } from './params'

describe('meetings filtersSearcheParams', () => {
  it('parses search correctly', () => {
    const search = filtersSearcheParams.search.parse('math')
    expect(search).toBe('math')
  })

  it('parses page correctly', () => {
    const page = filtersSearcheParams.page.parse('2')
    expect(page).toBe(2)
  })

  it('parses status correctly', () => {
    const status = filtersSearcheParams.status.parse('active')
    expect(status).toBe('active')
  })

  it('returns null for invalid status', () => {
    const status = filtersSearcheParams.status.parse('invalid')
    expect(status).toBeNull()
  })
})
