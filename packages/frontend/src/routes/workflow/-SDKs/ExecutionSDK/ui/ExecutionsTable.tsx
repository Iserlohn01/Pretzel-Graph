import { useMemo, useState } from 'react'
import {
    columnFilteringFeature,
    createColumnHelper,
    createFilteredRowModel,
    createSortedRowModel,
    rowSortingFeature,
    type ColumnDef,
    sortFn_basic,
    sortFn_datetime,
    tableFeatures,
    useTable,
} from '@tanstack/react-table'
import JsonView from 'react18-json-view'
import 'react18-json-view/src/style.css'
import 'react18-json-view/src/dark.css'
import { Badge, Button, DropdownMenu, Popover, ScrollArea, Table } from '@pretzel-graph/standard-ui/foundations'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { Execution, SystemError, type Workflow } from '@pretzel-graph/shared/domain'
import { ExecutionSDK } from '../sdk'


const STATUS_VARIANT: Record<Execution.Status, 'success' | 'destructive' | 'secondary' | 'outline'> = {
    pending: 'outline',
    running: 'secondary',
    paused: 'secondary',
    suspended: 'secondary',
    completed: 'success',
    failed: 'destructive',
    terminated: 'destructive',
}


const features = tableFeatures({
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { datetime: sortFn_datetime, basic: sortFn_basic },

    columnFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
})


const includesSome = (row: { getValue: (id: string) => unknown }, columnId: string, selected: unknown[]) =>
    selected.length === 0 || selected.includes(row.getValue(columnId))


// Single source of truth for the filterable columns: the column defs accessor rows
// through these, and the facet counts are derived from the same functions, so the
// dropdown options can never drift from what the column actually shows.
const FILTERABLE: Record<string, (e: Execution.Meta) => unknown> = {
    status: e => e.status,
    trigger: e => e.igniter_variant,
    has_recording: e => e.has_recording,
}


const columnHelper = createColumnHelper<typeof features, Execution.Meta>()

// TValue must stay loose — the column defs have mixed value types (string union,
// Date, number, boolean) and v9's ColumnDef union won't unify them otherwise.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columns: ColumnDef<typeof features, Execution.Meta, any>[] = [
    columnHelper.accessor(FILTERABLE.status, {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        filterFn: includesSome,
        cell: ({ getValue }) => {
            const status = getValue() as Execution.Status

            return (
                <Badge variant={STATUS_VARIANT[status]} size='sm'>
                    {status}
                </Badge>
            )
        },
    }),

    columnHelper.accessor(FILTERABLE.trigger, {
        id: 'trigger',
        header: 'Trigger',
        enableSorting: false,
        filterFn: includesSome,
        cell: ({ getValue }) => (
            <span className='text-xs text-muted-foreground font-mono'>{getValue()}</span>
        ),
    }),

    columnHelper.accessor(row => new Date(row.created_at), {
        id: 'created_at',
        header: 'Started',
        sortFn: 'datetime',
        enableColumnFilter: false,
        cell: ({ getValue }) => (
            <span className='text-xs'>{getValue().toLocaleString()}</span>
        ),
    }),

    columnHelper.accessor('duration', {
        id: 'duration',
        header: 'Duration',
        sortFn: 'basic',
        enableColumnFilter: false,
        cell: ({ getValue }) => (
            <span className='text-xs font-mono'>{formatDuration(getValue())}</span>
        ),
    }),

    columnHelper.accessor(FILTERABLE.has_recording, {
        id: 'has_recording',
        header: 'Recording',
        enableSorting: false,
        filterFn: includesSome,
        cell: ({ getValue }) => (
            getValue() ? <SystemIcons.Activity size={14} className='opacity-60' /> : null
        ),
    }),

    columnHelper.accessor(row => row.error ?? null, {
        id: 'error',
        header: 'Error',
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ getValue }) => <ErrorCell error={getValue()} />,
    }),
]


function ErrorCell({ error }: { error: SystemError.Serialized | null }) {
    if (!error)
        return null

    return (
        <Popover.Root>
            <Popover.Trigger
                aria-label='Show error'
                className='mx-auto flex size-7 items-center justify-center rounded-md text-destructive opacity-80 transition-colors hover:bg-destructive/10 hover:opacity-100'
            >
                <SystemIcons.AlertTriangleFill size={18} />
            </Popover.Trigger>

            <Popover.Content align='end' className='w-[420px] p-0'>
                <div className='flex flex-col gap-1 px-3 py-2'>
                    <p className='text-xs font-semibold text-foreground break-words'>
                        {error.message}
                    </p>

                    <p className='text-xs text-muted-foreground'>
                        Code <span className='text-destructive font-medium'>{codeLabel(error.code)}</span>
                    </p>
                </div>

                <div className='border-t border-border' />

                <ScrollArea.Root className='max-h-[360px] px-3 py-2 text-[11px] leading-relaxed'>
                    <JsonView
                        src={error}
                        collapsed={2}
                        theme='default'
                    />
                </ScrollArea.Root>
            </Popover.Content>
        </Popover.Root>
    )
}


// Numeric enums reverse-map, so the wire code renders as its name.
const codeLabel = (code: SystemError.Code) => `${SystemError.Code[code] ?? 'UNKNOWN'} (${code})`


export function ExecutionsTable({ workflowId }: { workflowId: Workflow.Id }) {
    const [, [{ data, isPending, isError }]] = ExecutionSDK.useWith(() => null, (q) => [q.list(workflowId)])

    const executions = useMemo(() => data ?? [], [data])

    const table = useTable(
        {
            features,
            columns,
            data: executions,
            initialState: { sorting: [{ id: 'created_at', desc: true }] },
        },
        s => ({ sorting: s.sorting, columnFilters: s.columnFilters }),
    )

    const rows = table.getRowModel().rows
    const filters = table.state.columnFilters
    const hasFilters = filters.length > 0

    // Facets computed straight from the fetched rows rather than the table's faceting
    // feature — that reads a render-phase snapshot which lags, so options intermittently
    // came back empty. Each column's counts honour every *other* column's filter.
    const facets = useMemo(() => {
        const byColumn: Record<string, Map<unknown, number>> = {}

        for (const [columnId, accessor] of Object.entries(FILTERABLE)) {
            const others = filters.filter(f => f.id !== columnId)
            const counts = new Map<unknown, number>()

            for (const execution of executions) {
                const passesOthers = others.every(f => {
                    const otherAccessor = FILTERABLE[f.id]

                    if (!otherAccessor)
                        return true

                    return (f.value as unknown[]).includes(otherAccessor(execution))
                })

                if (!passesOthers)
                    continue

                const value = accessor(execution)
                counts.set(value, (counts.get(value) ?? 0) + 1)
            }

            byColumn[columnId] = counts
        }

        return byColumn
    }, [executions, filters])

    const emptyMessage =
        isError ? 'Could not load executions.'
            : isPending ? 'Loading executions…'
                : executions.length === 0 ? 'This workflow has no executions yet.'
                    : rows.length === 0 ? 'No executions match these filters.'
                        : null

    return (
        <>
                <Table.Root>
                    <Table.Header>
                        {table.getHeaderGroups().map(group => (
                            <Table.Row key={group.id}>
                                {group.headers.map(header => (
                                    <Table.Head key={header.id} className={HEAD_WIDTH[header.column.id]}>
                                        {header.column.getCanFilter()
                                            ? <FilterHeader
                                                column={header.column}
                                                filters={filters}
                                                facets={facets[header.column.id] ?? EMPTY_FACETS}
                                            />
                                            : header.column.getCanSort()
                                                ? (
                                                    <button
                                                        className='flex items-center gap-1 hover:text-foreground transition-colors'
                                                        onClick={header.column.getToggleSortingHandler()}
                                                    >
                                                        <table.FlexRender header={header} />
                                                        <SortIcon direction={header.column.getIsSorted()} />
                                                    </button>
                                                )
                                                : <table.FlexRender header={header} />
                                        }
                                    </Table.Head>
                                ))}
                            </Table.Row>
                        ))}
                    </Table.Header>

                    <Table.Body>
                        {emptyMessage
                            ? (
                                <Table.Row className='hover:bg-transparent'>
                                    <Table.Cell colSpan={columns.length}>
                                        <Placeholder text={emptyMessage} />
                                    </Table.Cell>
                                </Table.Row>
                            )
                            : rows.map(row => (
                                <Table.Row key={row.id}>
                                    {row.getAllCells().map(cell => (
                                        <Table.Cell key={cell.id}>
                                            <table.FlexRender cell={cell} />
                                        </Table.Cell>
                                    ))}
                                </Table.Row>
                            ))
                        }
                    </Table.Body>
                </Table.Root>
       
        </>
    )
}


const HEAD_WIDTH: Record<string, string> = {
    status: 'w-[110px]',
    created_at: 'w-[180px]',
    duration: 'w-[100px]',
    has_recording: 'w-[90px]',
    error: 'w-[70px] text-center',
}


type FilterColumn = {
    id: string
    columnDef: { header?: unknown }
    setFilterValue: (value: unknown) => void
}

type ColumnFilter = { id: string, value: unknown }

const EMPTY_FACETS = new Map<unknown, number>()

const FACET_LABEL: Record<string, (value: unknown) => string> = {
    has_recording: value => value ? 'With recording' : 'No recording',
}

// Both `selected` and `facets` are passed in from state the component subscribes to,
// never read live off the table during render — those reads are served from a
// render-phase snapshot that lags, which is what made this dropdown unreliable.
function FilterHeader({ column, filters, facets }: {
    column: FilterColumn
    filters: ColumnFilter[]
    facets: Map<unknown, number>
}) {
    const selected = (filters.find(f => f.id === column.id)?.value as unknown[]) ?? []
    const label = String(column.columnDef.header ?? column.id)
    const format = FACET_LABEL[column.id] ?? String

    const options = useMemo(
        () => [...facets.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        [facets],
    )

    const toggle = (value: unknown) => {
        const next = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value]

        column.setFilterValue(next.length > 0 ? next : undefined)
    }

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    data-filtered={selected.length > 0 || undefined}
                    className='flex items-center gap-1 hover:text-foreground transition-colors data-[filtered]:text-foreground'
                >
                    {label}

                    {selected.length > 0 && (
                        <Badge variant='secondary' size='xs'>
                            {selected.length}
                        </Badge>
                    )}

                    <SystemIcons.ChevronDown size={12} className='opacity-40' />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content align='start' className='min-w-[180px]'>
                {options.length === 0 && (
                    <div className='px-2 py-1.5 text-xs text-muted-foreground'>
                        No values
                    </div>
                )}

                {options.map(([value, count]) => (
                    <DropdownMenu.CheckboxItem
                        key={String(value)}
                        checked={selected.includes(value)}
                        onCheckedChange={() => toggle(value)}
                        onSelect={e => e.preventDefault()}
                        className='text-xs data-[state=checked]:text-foreground data-[state=checked]:font-medium'
                    >
                        <span>{format(value)}</span>
                        <span className='ml-auto text-muted-foreground'>{count}</span>
                    </DropdownMenu.CheckboxItem>
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    )
}


function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
    if (!direction)
        return null

    return direction === 'asc'
        ? <SystemIcons.ChevronUp size={12} className='opacity-70' />
        : <SystemIcons.ChevronDown size={12} className='opacity-70' />
}


function Placeholder({ text }: { text: string }) {
    return (
        <div className='text-sm text-muted-foreground py-10 text-center'>
            {text}
        </div>
    )
}


function formatDuration(ms: number) {
    if (ms < 1000)
        return `${ms}ms`

    return `${(ms / 1000).toFixed(1)}s`
}
