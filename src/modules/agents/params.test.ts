import { describe, it, expect } from 'vitest'
import { filtersSearcheParams } from './params'

describe('agents filtersSearcheParams', () => {
  it('parses search correctly', () => {
    const search = filtersSearcheParams.search.parse('ai')
    expect(search).toBe('ai')
  })

  it('parses page correctly', () => {
    const page = filtersSearcheParams.page.parse('3')
    expect(page).toBe(3)
  })
})
