import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * On a phone (under 640px) each row turns into a small card: the first cell is the title and every other cell is a
 * "Column name: value" line, so nothing is squeezed or scrolled sideways. The column names are copied from the header row
 * by <MobileTables /> (components/layout/mobile-tables.tsx), which also does this for plain <table>s.
 * Pass stack={false} for a table that should keep its columns and scroll instead (wide data previews).
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { stack?: boolean }
>(({ className, stack = true, ...props }, ref) => (
  <div className="relative max-h-[70vh] w-full overflow-auto max-sm:max-h-none">
    <table
      ref={ref}
      data-stack={stack ? undefined : "off"}
      className={cn("w-max min-w-full border-separate border-spacing-0 caption-bottom text-[13px]", stack && "stack-mobile", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_th]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child>td]:border-b-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "group/row transition-colors hover:bg-muted data-[state=selected]:bg-muted [&:hover>td]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "sticky top-0 z-10 first:left-0 first:z-20 h-10 whitespace-nowrap bg-muted px-[18px] text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "whitespace-nowrap border-b bg-card first:sticky first:left-0 first:z-[1] first:shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)] px-[18px] py-2.5 align-middle text-[13px] [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
