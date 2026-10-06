"use client";

import { Check, Columns3, Filter, Search, X } from "lucide-react";
import { useState, type ChangeEvent, type ReactNode } from "react";
import { Button } from "../components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../components/dropdown-menu";
import { Input } from "../components/input";
import { cn } from "../lib/utils";
import type { WorkspaceColumnOption, WorkspaceFilterOption } from "./types";

export function WorkspaceFilters({
  className,
  columnOptions,
  filterOptions,
  filterValue,
  onColumnToggle: _onColumnToggle,
  onFilterValueChange,
  onSearchValueChange,
  onShowAllColumns,
  searchPlaceholder,
  searchValue,
  toolbarAction
}: {
  className?: string;
  columnOptions?: WorkspaceColumnOption[];
  filterOptions?: WorkspaceFilterOption[];
  filterValue?: string;
  onColumnToggle?: (id: string, checked: boolean) => void;
  onFilterValueChange?: (value: string) => void;
  onSearchValueChange: (value: string) => void;
  onShowAllColumns?: () => void;
  searchPlaceholder?: string;
  searchValue: string;
  toolbarAction?: ReactNode;
}) {
  const activeFilter = filterOptions?.find((option) => option.id === filterValue);
  const defaultFilter = filterOptions?.[0];
  const showActiveFilter =
    activeFilter && defaultFilter && activeFilter.id !== defaultFilter.id && onFilterValueChange;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border border-border/70 bg-card/95 p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-3",
        className
      )}
    >
      <div className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 rounded-md border-border/80 bg-white pl-9 text-sm shadow-none"
          {...(searchPlaceholder ? { placeholder: searchPlaceholder } : {})}
          value={searchValue}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onSearchValueChange(event.target.value)
          }
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5 self-end sm:self-auto">
        {toolbarAction}
        {showActiveFilter ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 py-1 pl-2.5 pr-1 text-sm font-medium text-primary">
            <span className="max-w-40 truncate">{activeFilter.label}</span>
            {activeFilter.count !== undefined ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-xs tabular-nums">
                {activeFilter.count}
              </span>
            ) : null}
            <button
              aria-label={`Clear ${activeFilter.label} filter`}
              className="flex size-6 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-primary/15 focus-visible:bg-primary/15 focus-visible:outline-none"
              onClick={() => onFilterValueChange(defaultFilter.id)}
              type="button"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        ) : null}
        {filterOptions && filterOptions.length > 0 && filterValue && onFilterValueChange ? (
          <FilterMenu
            filterOptions={filterOptions}
            filterValue={filterValue}
            onFilterValueChange={onFilterValueChange}
          />
        ) : null}
        {columnOptions && columnOptions.length > 0 ? (
          <ColumnMenu
            columnOptions={columnOptions}
            {...(onShowAllColumns ? { onShowAllColumns } : {})}
          />
        ) : null}
      </div>
    </div>
  );
}

function FilterMenu({
  filterOptions,
  filterValue,
  onFilterValueChange
}: {
  filterOptions: WorkspaceFilterOption[];
  filterValue: string;
  onFilterValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  function applyFilter(value: string) {
    onFilterValueChange(value);
    setOpen(false);
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-8 rounded-md border-border/80 bg-white px-3 text-sm shadow-none"
          type="button"
          variant="outline"
        >
          <Filter className="size-4" />
          Filters
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-md p-0 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-medium">Filter options</DropdownMenuLabel>
          <button
            className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => applyFilter(filterOptions[0]?.id ?? filterValue)}
            type="button"
          >
            Clear
          </button>
        </div>
        <DropdownMenuSeparator />
        <div className="p-2">
          {filterOptions.map((option) => {
            const selected = filterValue === option.id;
            return (
              <button
                key={option.id}
                className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:outline-none"
                onPointerDown={(event) => {
                  event.preventDefault();
                  applyFilter(option.id);
                }}
                type="button"
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {selected ? <Check aria-hidden="true" className="size-4" /> : null}
                </span>
                <span className="min-w-0 flex-1">{option.label}</span>
                {option.count !== undefined ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary ring-1 ring-inset ring-primary/15">
                    {option.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColumnMenu({
  columnOptions,
  onShowAllColumns
}: {
  columnOptions: WorkspaceColumnOption[];
  onShowAllColumns?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-8 rounded-md border-border/80 bg-white px-3 text-sm shadow-none"
          type="button"
          variant="outline"
        >
          <Columns3 className="size-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-md p-0 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-medium">Visible columns</DropdownMenuLabel>
          {onShowAllColumns ? (
            <button
              className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={onShowAllColumns}
              type="button"
            >
              Show all
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <div className="p-2">
          {columnOptions.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.checked}
              className="rounded-md py-2.5 pl-9 pr-3"
              {...(column.disabled !== undefined ? { disabled: column.disabled } : {})}
              onCheckedChange={(checked) => column.onCheckedChange(Boolean(checked))}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
