import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ResponsiveDialog } from './responsive-dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import React from 'react'

// Mock useIsMobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(),
}))

// Mock UI components to simplify tests
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('./ui/drawer', () => ({
  Drawer: ({ children, open }: any) => open ? <div data-testid="drawer">{children}</div> : null,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <div>{children}</div>,
  DrawerDescription: ({ children }: any) => <div>{children}</div>,
}))

describe('ResponsiveDialog', () => {
  it('renders Dialog on desktop', () => {
    vi.mocked(useIsMobile).mockReturnValue(false)
    render(
      <ResponsiveDialog title="Test Title" description="Test Desc" open={true} onOpenChange={() => {}}>
        <div>Dialog Content</div>
      </ResponsiveDialog>
    )
    expect(screen.getByTestId('dialog')).toBeDefined()
    expect(screen.queryByTestId('drawer')).toBeNull()
  })

  it('renders Drawer on mobile', () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    render(
      <ResponsiveDialog title="Test Title" description="Test Desc" open={true} onOpenChange={() => {}}>
        <div>Drawer Content</div>
      </ResponsiveDialog>
    )
    expect(screen.getByTestId('drawer')).toBeDefined()
    expect(screen.queryByTestId('dialog')).toBeNull()
  })
})
