import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EmptyState } from './empty-state'
import React from 'react'

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No Meetings" description="You have no upcoming meetings." />)
    expect(screen.getByText('No Meetings')).toBeDefined()
    expect(screen.getByText('You have no upcoming meetings.')).toBeDefined()
  })

  it('renders CTA button when provided', () => {
    const onCtaClick = vi.fn()
    render(
      <EmptyState 
        title="No Meetings" 
        description="Test" 
        ctaLabel="Create Meeting" 
        onCtaClick={onCtaClick} 
      />
    )
    const button = screen.getByRole('button', { name: /create meeting/i })
    expect(button).toBeDefined()
    fireEvent.click(button)
    expect(onCtaClick).toHaveBeenCalled()
  })

  it('does not render CTA button when not provided', () => {
    render(<EmptyState title="No Meetings" description="Test" />)
    const button = screen.queryByRole('button')
    expect(button).toBeNull()
  })
})
