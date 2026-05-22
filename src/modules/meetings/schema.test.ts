import { describe, it, expect } from 'vitest'
import { meetingsInsertSchema } from './schema'

describe('meetingsInsertSchema', () => {
  it('validates correct meeting data', () => {
    const data = {
      name: 'Math Session',
      agentId: 'agent-123',
      isPublic: true,
    }
    const result = meetingsInsertSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const data = {
      agentId: 'agent-123',
      isPublic: true,
    }
    const result = meetingsInsertSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects missing agentId', () => {
    const data = {
      name: 'Math Session',
      isPublic: true,
    }
    const result = meetingsInsertSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
