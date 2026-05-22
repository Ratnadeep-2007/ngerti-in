import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DataPagination } from './data-pagination'
import React from 'react'

describe('DataPagination', () => {
  it('renders correctly with current page and total pages', () => {
    render(<DataPagination page={1} totalPages={5} onPageChange={() => {}} />)
    expect(screen.getByText('Page 1 of 5')).toBeDefined()
  })

  it('disables previous button on first page', () => {
    render(<DataPagination page={1} totalPages={5} onPageChange={() => {}} />)
    const prevButton = screen.getByRole('button', { name: /previous/i })
    expect(prevButton).toHaveProperty('disabled', true)
  })

  it('disables next button on last page', () => {
    render(<DataPagination page={5} totalPages={5} onPageChange={() => {}} />)
    const nextButton = screen.getByRole('button', { name: /next/i })
    expect(nextButton).toHaveProperty('disabled', true)
  })

  it('calls onPageChange when previous button is clicked', () => {
    const onPageChange = vi.fn()
    render(<DataPagination page={2} totalPages={5} onPageChange={onPageChange} />)
    const prevButton = screen.getByRole('button', { name: /previous/i })
    fireEvent.click(prevButton)
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('calls onPageChange when next button is clicked', () => {
    const onPageChange = vi.fn()
    render(<DataPagination page={2} totalPages={5} onPageChange={onPageChange} />)
    const nextButton = screen.getByRole('button', { name: /next/i })
    fireEvent.click(nextButton)
    expect(onPageChange).toHaveBeenCalledWith(3)
  })
})
