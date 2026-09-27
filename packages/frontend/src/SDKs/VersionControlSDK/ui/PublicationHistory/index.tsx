import { cn } from "@/utils/styleUtils";
import { LibrarySDK } from "@/SDKs/LibrarySDK/sdk";
import { WorkbenchSDK } from "@/routes/workflow/-SDKs/WorkbenchSDK/sdk";
import { Badge, Button, ScrollArea, Spinner } from "@pretzel-graph/standard-ui/foundations";
import { Accordion } from "@pretzel-graph/standard-ui/foundations/accordion";
import { VersionControlSDK } from "../../sdk";
import { TimelineItem } from "./TimelineItem";
import { formatTimelineTimestamp, getPublicationLabel } from "../../utils";
import { DeploymentToggle } from "../DeploymentToggle";

const RECENT_GROUP_SIZE = 4;

interface PublicationHistoryProps {
    className?: string;
    hideHeader?: boolean;
    showCurrentChangesItem?: boolean;
}

function PublicationHistory({ className, hideHeader, showCurrentChangesItem = true }: PublicationHistoryProps) {
    const [workflowId, isDirty] = WorkbenchSDK.useDocument(d => [d.workflowId, d.isDirty]);
    const workflowUpdatedAt = LibrarySDK.useStore(s => s.workflowMetas[workflowId]?.updated_at);

    const [, [versionsQuery]] = VersionControlSDK.useWith(
        () => null,
        (q) => [q.publications(workflowId)],
    );

    const publications = versionsQuery.data?.publications ?? [];
    const recentPublications = publications.slice(0, RECENT_GROUP_SIZE);
    const olderPublications = publications.slice(RECENT_GROUP_SIZE);

    return (
        <div className={cn("w-[340px] overflow-hidden", className)}>
            {!hideHeader && <div className="flex items-center justify-between border-b border-border/70 py-2 px-3">
                <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">
                        Publication history
                    </div>
                </div>
                <DeploymentToggle size="icon-xs" />
            </div>}

            <ScrollArea.Root className="max-h-[420px]">
                <div className="space-y-3 p-2">
                    {showCurrentChangesItem &&
                        <TimelineItem
                            actionType="draft"
                            highlighted={isDirty}
                            label="Current changes"
                            marker={<span className={`size-2 rounded-full ${isDirty ? "bg-amber-500" : "bg-muted-foreground/40"}`} />}
                            showLine={publications.length > 0}
                            subtitle={formatTimelineTimestamp(workflowUpdatedAt)}
                        />
                    }

                    {versionsQuery.isLoading && (
                        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
                            <Spinner className="size-4" />
                            Loading versions...
                        </div>
                    )}

                    {versionsQuery.isError && (
                        <div className="rounded-xl border border-dashed border-destructive/30 px-3 py-4">
                            <div className="text-sm font-medium text-foreground">
                                Could not load publication history
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                Try refreshing the list.
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => void versionsQuery.refetch()}
                            >
                                Retry
                            </Button>
                        </div>
                    )}

                    {!versionsQuery.isLoading && !versionsQuery.isError && publications.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border/80 px-3 py-4">
                            <div className="text-sm font-medium text-foreground">
                                No published versions yet
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                Publish the current workflow state to start tracking releases.
                            </div>
                        </div>
                    )}

                    {!versionsQuery.isLoading && !versionsQuery.isError && publications.length > 0 && (
                        <Accordion.Root type="multiple" defaultValue={["recent"]} className="space-y-1">
                            <Accordion.Item value="recent" className="border-none">
                                <Accordion.Trigger className="px-1 py-1.5 text-xs font-medium text-muted-foreground hover:no-underline">
                                    {recentPublications.length} version{recentPublications.length === 1 ? "" : "s"}
                                </Accordion.Trigger>
                                <Accordion.Content className="space-y-2 pt-1">
                                    {recentPublications.map((publication, index) => (
                                        <TimelineItem
                                            actionType="publication"
                                            key={publication.id}
                                            badge={publication.is_deployed ? <Badge variant="success" size={"xs"}>Deployed</Badge> : undefined}
                                            label={getPublicationLabel(publication)}
                                            marker={<span className={`size-2 rounded-full border ${publication.is_deployed ? "border-primary bg-primary" : "border-border bg-background"}`} />}
                                            publication={publication}
                                            showLine={index < recentPublications.length - 1 || olderPublications.length > 0}
                                            subtitle={formatTimelineTimestamp(publication.published_at)}
                                        />
                                    ))}
                                </Accordion.Content>
                            </Accordion.Item>

                            {olderPublications.length > 0 && (
                                <Accordion.Item value="older" className="border-none">
                                    <Accordion.Trigger className="px-1 py-1.5 text-xs font-medium text-muted-foreground hover:no-underline">
                                        {olderPublications.length} older version{olderPublications.length === 1 ? "" : "s"}
                                    </Accordion.Trigger>
                                    <Accordion.Content className="space-y-2 pt-1">
                                        {olderPublications.map((publication, index) => (
                                            <TimelineItem
                                                actionType="publication"
                                                key={publication.id}
                                                badge={publication.is_deployed ? <Badge size={"xs"} variant="success">Deployed</Badge> : undefined}
                                                label={getPublicationLabel(publication)}
                                                marker={<span className={`size-2 rounded-full border ${publication.is_deployed ? "border-primary bg-primary" : "border-border bg-background"}`} />}
                                                publication={publication}
                                                showLine={index < olderPublications.length - 1}
                                                subtitle={formatTimelineTimestamp(publication.published_at)}
                                            />
                                        ))}
                                    </Accordion.Content>
                                </Accordion.Item>
                            )}
                        </Accordion.Root>
                    )}
                </div>
            </ScrollArea.Root>
        </div>
    );
}

export default PublicationHistory;
