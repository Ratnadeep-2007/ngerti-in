import { describe, it, expect } from 'vitest'
import { generatedAvatarUri } from './avatar'

describe('generatedAvatarUri', () => {
  it('generates a botttsNeutral avatar URI', () => {
    const uri = generatedAvatarUri({ seed: 'test-seed', variant: 'botttsNeutral' })
    expect(uri).toContain('data:image/svg+xml')
    expect(uri).toContain('Bottts')
  })

  it('generates an initials avatar URI', () => {
    const uri = generatedAvatarUri({ seed: 'JS', variant: 'initials' })
    expect(uri).toContain('data:image/svg+xml')
    expect(uri).toContain('Initials')
  })

  it('generates different URIs for different seeds', () => {
    const uri1 = generatedAvatarUri({ seed: 'seed1', variant: 'botttsNeutral' })
    const uri2 = generatedAvatarUri({ seed: 'seed2', variant: 'botttsNeutral' })
    expect(uri1).not.toBe(uri2)
  })
})
