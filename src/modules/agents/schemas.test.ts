import { describe, it, expect } from 'vitest'
import { agentsInsertSchema } from './schemas'

describe('agentsInsertSchema', () => {
  it('validates correct agent data', () => {
    const data = {
      name: 'Professor Math',
      subject: 'Maths',
      language: 'English (Formal)',
    }
    const result = agentsInsertSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects invalid subject', () => {
    const data = {
      name: 'Professor Math',
      subject: 'History', // Not in the enum
      language: 'English (Formal)',
    }
    const result = agentsInsertSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects missing language', () => {
    const data = {
      name: 'Professor Math',
      subject: 'Maths',
    }
    const result = agentsInsertSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
