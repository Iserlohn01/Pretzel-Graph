import { useState } from 'react'
import { Button, Frame, Spinner, Tooltip } from '@pretzel-graph/standard-ui/foundations'
import { Card } from '@pretzel-graph/standard-ui/foundations/card'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { IconRenderer } from '@pretzel-graph/standard-ui/icons/IconRenderer'
import { WorkflowIllustration } from '@pretzel-graph/standard-ui/icons/illustrations'
import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import type { Library, Listing, Template } from '@pretzel-graph/shared/domain'
import { TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateCategoryId } from '@pretzel-graph/shared/constants/templateCategories'
import { cn } from '@pretzel-graph/standard-ui/utils/cn'
import { toast } from 'sonner'
import { router } from '@/main'
import { LibrarySDK } from '../sdk'
import { openCreateWorkflowDialog } from './workflow-dialogs'

// Every integration blueprint id starts with this.
const INTEGRATION_BLUEPRINT_ID_PREFIX = 'Integrations.'

// The sidebar entry that shows every template.
const ALL_TEMPLATES = 'all'

type Selection = TemplateCategoryId | typeof ALL_TEMPLATES

type SidebarSection = {
    title: string | null
    categories: TemplateCategory[]
}

export function openTemplateGalleryDialog(args: { folder_id: Library.Folder.Id }) {
    const id = `template-gallery-${args.folder_id}`
    DialogSDK.actions.push(id, (props) => (
        <TemplateGallery dialogProps={props} dialogId={id} {...args} />
    ))
}

function colorOf(token: string | null) {
    return token ? `var(--${token})` : 'var(--primary)'
}

// Categories that hold at least one template, grouped by section in sidebar order.
function getSidebarSections(templates: Template[]): SidebarSection[] {
    const usedCategoryIds = new Set(templates.flatMap((template) => template.categoryIds))
    const sectionsByTitle = new Map<string | null, SidebarSection>([[null, { title: null, categories: [] }]])

    for (const category of Object.values(TEMPLATE_CATEGORIES)) {
        if (!usedCategoryIds.has(category.id))
            continue

        const section = sectionsByTitle.get(category.section) ?? { title: category.section, categories: [] }

        section.categories.push(category)

        sectionsByTitle.set(category.section, section)
    }

    return [...sectionsByTitle.values()]
}

interface TemplateGalleryProps {
    dialogProps: DialogSDK.TemplateProps
    dialogId: string
    folder_id: Library.Folder.Id
}

function TemplateGallery({ dialogProps, dialogId, folder_id }: TemplateGalleryProps) {
    const [templates, [request]] = LibrarySDK.useWith(
        (s) => s.templates,
        (q) => [q.templates],
    )

    const [pickedSelection, setPickedSelection] = useState<Selection | null>(null)

    const [remixingListingId, setRemixingListingId] = useState<Listing.Id | null>(null)

    const sortedTemplates = Object.values(templates).sort((a, b) => a.sortOrder - b.sortOrder)

    const [topSection, ...sections] = getSidebarSections(sortedTemplates)

    const selection = pickedSelection ?? topSection.categories[0]?.id ?? ALL_TEMPLATES

    const selectedCategory = selection === ALL_TEMPLATES ? null : TEMPLATE_CATEGORIES[selection]

    const visibleTemplates = selectedCategory
        ? sortedTemplates.filter((template) => template.categoryIds.includes(selectedCategory.id))
        : sortedTemplates

    const onRemix = async (template: Template) => {
        setRemixingListingId(template.listingId)

        try {
            const workflow = await LibrarySDK.actions.template.remix(template.listingId, folder_id)
            toast.success(`${template.name} added to your library`)
            DialogSDK.actions.pop(dialogId)
            void router.navigate({ to: '/workflow/$workflowid', params: { workflowid: workflow.id } })
        } catch (err) {
            console.error('Failed to create workflow from template', err)
            toast.error('Failed to create workflow from template')
        } finally {
            setRemixingListingId(null)
        }
    }

    const onBlank = () => {
        openCreateWorkflowDialog({ folder_id, onCreated: () => DialogSDK.actions.pop(dialogId) })
    }

    return (
        <DialogSDK.SplitTemplate {...dialogProps}
            className='w-[960px] max-w-[95vw] h-[600px] max-h-[85vh]'
            sidebarClassName='w-[220px] px-4! shrink-0 overflow-y-auto'
            contentClassName='min-w-0'
            sidebarRenderer={() => (
                <nav className='flex flex-col gap-1'>
                    <h2 className='pb-2 text-base font-medium'>Templates</h2>
                    {topSection.categories.map((category) => (
                        <SidebarEntry
                            key={category.id}
                            icon={category.icon}
                            label={category.label}
                            active={selection === category.id}
                            onClick={() => setPickedSelection(category.id)}
                        />
                    ))}
                    <SidebarEntry
                        icon='Layers'
                        label='All templates'
                        active={selection === ALL_TEMPLATES}
                        onClick={() => setPickedSelection(ALL_TEMPLATES)}
                    />
                    {sections.map((section) => (
                        <div key={section.title} className='flex flex-col gap-1 pt-4'>
                            <p className='px-2 pb-1 text-xs text-muted-foreground'>{section.title}</p>
                            {section.categories.map((category) => (
                                <SidebarEntry
                                    key={category.id}
                                    icon={category.icon}
                                    label={category.label}
                                    active={selection === category.id}
                                    onClick={() => setPickedSelection(category.id)}
                                />
                            ))}
                        </div>
                    ))}
                </nav>
            )}
        >
            <DialogSDK.SplitTemplate.Header>
                <DialogSDK.SplitTemplate.Title>{selectedCategory?.label ?? 'All templates'}</DialogSDK.SplitTemplate.Title>
                <DialogSDK.SplitTemplate.Description>Start from a copy of a published workflow.</DialogSDK.SplitTemplate.Description>
            </DialogSDK.SplitTemplate.Header>

            <div className='min-h-0 flex-1 overflow-y-auto'>
                {request.isPending && sortedTemplates.length === 0 ? (
                    <div className='flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground'>
                        <Spinner className='size-3.5' />
                        Loading templates…
                    </div>
                ) : sortedTemplates.length === 0 ? (
                    <p className='py-16 text-center text-sm text-muted-foreground'>No templates are available.</p>
                ) : (
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                        {visibleTemplates.map((template) => (
                            <TemplateCard
                                key={template.listingId}
                                template={template}
                                disabled={remixingListingId !== null}
                                loading={remixingListingId === template.listingId}
                                onClick={() => void onRemix(template)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className='flex items-center gap-4 pt-2'>
                <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium'>Start from scratch</p>
                    <p className='text-xs text-muted-foreground'>Begin with an empty workflow.</p>
                </div>
                <Button variant="default" onClick={onBlank} disabled={remixingListingId !== null}>
                    <SystemIcons.Plus />
                    Blank workflow
                </Button>
            </div>
        </DialogSDK.SplitTemplate>
    )
}

function SidebarEntry({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
            )}
        >
            <IconRenderer name={icon} className='size-4 shrink-0' />
            <span className='truncate'>{label}</span>
        </button>
    )
}

function TemplateCard({ template, disabled, loading, onClick }: {
    template: Template
    disabled: boolean
    loading: boolean
    onClick: () => void
}) {
    const integrationBlueprintMetas = Object.values(template.blueprintMetas)
        .filter((blueprintMeta) => blueprintMeta.id.startsWith(INTEGRATION_BLUEPRINT_ID_PREFIX))

    return (
        <Frame.Root className='w-full overflow-hidden'>
            <Frame.Panel
                className={cn('h-[120px] flex flex-col transition-shadow p-0 pt-3 pb-2', disabled ? 'cursor-default opacity-60' : 'cursor-pointer')}
                aria-disabled={disabled}
                onClick={disabled ? undefined : onClick}
            >
                <Card.Header>
                    <div className='flex flex-row items-center gap-2 min-w-0'>
                        {template.icon ? (
                            <IconRenderer name={template.icon} className='size-6 shrink-0' style={{ color: colorOf(template.iconColor ?? template.accent) }} />
                        ) : (
                            <WorkflowIllustration className='size-6 shrink-0' style={{ color: 'var(--primary)' }} />
                        )}
                        <Card.Title className='text-sm truncate'>{template.name}</Card.Title>
                        {loading && <Spinner className='size-3.5 shrink-0' />}
                    </div>
                </Card.Header>
                {template.description && (
                    <Card.Content className='mt-2'>
                        <p className='line-clamp-2 text-xs text-muted-foreground'>{template.description}</p>
                    </Card.Content>
                )}
            </Frame.Panel>
            <Frame.Footer className='flex flex-row items-center gap-1 px-2! py-1! overflow-x-auto w-full h-[35px] [scrollbar-width:none]'>
                {integrationBlueprintMetas.map((blueprintMeta) => (
                    <Tooltip.Root key={blueprintMeta.id}>
                        <Tooltip.Trigger className='flex shrink-0 p-1'>
                            <IconRenderer name={blueprintMeta.ui.icon} className='size-4' style={{ color: colorOf(blueprintMeta.ui.iconColor ?? blueprintMeta.ui.accent ?? null) }} />
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                            {blueprintMeta.ui.displayName}
                        </Tooltip.Content>
                    </Tooltip.Root>
                ))}
            </Frame.Footer>
        </Frame.Root>
    )
}
