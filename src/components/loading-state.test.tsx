import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import LoadingState from './loading-state'
import React from 'react'

describe('LoadingState', () => {
  it('renders title and description', () => {
    render(<LoadingState title="Loading..." description="Please wait" />)
    expect(screen.getByText('Loading...')).toBeDefined()
    expect(screen.getByText('Please wait')).toBeDefined()
  })
})
