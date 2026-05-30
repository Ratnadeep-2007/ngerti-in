"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  type: string;
  renderContextMenu?: (row: TData) => React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  type,
  renderContextMenu,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="h-full overflow-x-hidden rounded-lg border bg-background overflow-scroll max-h-full">
      <Table>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const rowContent = (
                <TableRow
                  onClick={() => onRowClick?.(row.original)}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm p-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );

              if (renderContextMenu) {
                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
                    {renderContextMenu(row.original)}
                  </ContextMenu>
                );
              }

              return <React.Fragment key={row.id}>{rowContent}</React.Fragment>;
            })
          ) : (
            <TableRow className="!bg-transparent !hover:bg-transparent !cursor-default">
              <TableCell
                colSpan={columns.length}
                className="h-96 text-center align-middle"
              >
                <div className="flex items-center justify-center w-full h-full">
                  Oops! It seems that you haven&apos;t made any {type} yet!
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
