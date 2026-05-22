import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ErrorState from './error-state'
import React from 'react'

describe('ErrorState', () => {
  it('renders title and description', () => {
    render(<ErrorState title="Error!" description="Something went wrong" />)
    expect(screen.getByText('Error!')).toBeDefined()
    expect(screen.getByText('Something went wrong')).toBeDefined()
  })
})
