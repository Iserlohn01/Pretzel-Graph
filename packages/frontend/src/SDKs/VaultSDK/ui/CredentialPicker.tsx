import { memo } from "react";
import { Select } from "@pretzel-graph/standard-ui/foundations/select";
import { Button } from "@pretzel-graph/standard-ui/foundations";
import { VaultSDK } from "../sdk";
import { DialogSDK } from "@pretzel-graph/standard-ui/SDKs/DialogSDK";
import { CredentialFormDialog } from "./CredentialForm";
import type { Vault } from "@pretzel-graph/shared/domain";
import { SystemIcons } from "@pretzel-graph/standard-ui/icons";
import FloatContainer from "@/components/FloatContainer";

// Picks a credential instance of one template; whoever renders it owns where the choice is stored.
interface Props {
    credentialTemplate: Vault.Credential.Template;
    instanceId:         Vault.Credential.Instance.Id | null;
    setInstance:        (instanceId: Vault.Credential.Instance.Id | null) => void;
    // Highlights the picker, e.g. when a required credential is missing.
    issue?:             boolean;
    showTitle?:         boolean;
}

export const CredentialPicker = memo(
    ({ credentialTemplate, instanceId, setInstance, issue = false, showTitle = true }: Props) => {
        const [instances] = VaultSDK.useWith(
            (s) => s.selectors.byTemplateId(s, credentialTemplate.id),
            (q) => [q.instances],
        );

        const openAddDialog = () => {
            const dialogId = `add-credentialTemplate-${credentialTemplate.id}`;
            DialogSDK.actions.push(dialogId, (props) => (
                <CredentialFormDialog
                    {...props}
                    credentialTemplate={credentialTemplate}
                    onCreated={(instanceId) => {
                        setInstance(instanceId);
                        DialogSDK.actions.pop(dialogId);
                    }}
                />
            ));
        };

        const openEditDialog = (editInstanceId: Vault.Credential.Instance.Id) => {
            const dialogId = `edit-credentialInstance-${editInstanceId}`;
            DialogSDK.actions.push(dialogId, (props) => (
                <CredentialFormDialog
                    {...props}
                    credentialTemplate={credentialTemplate}
                    updateProps={{
                        instanceId: editInstanceId,
                        onUpdateComplete: () => DialogSDK.actions.pop(dialogId),
                        onRemoved: () => {
                            setInstance(null);
                            DialogSDK.actions.pop(dialogId);
                        },
                    }}
                />
            ));
        };

        return (
            <div className="flex flex-col gap-1 w-full">
                {showTitle && (
                    <span className="text-xs font-medium text-muted-foreground">
                        {credentialTemplate.displayName}
                    </span>
                )}
                <div className="flex gap-1.5">
                    <Select.Root
                        value={instanceId ?? ""}
                        onValueChange={(val) =>
                            setInstance(val as Vault.Credential.Instance.Id)
                        }
                    >
                        <Select.Trigger
                            className={`flex-1 text-xs h-8${issue ? " border-2 border-destructive animate-border-ping focus-visible:ring-destructive/50" : ""}`}
                        >
                            <Select.Value placeholder="Select credential…" />
                        </Select.Trigger>
                        <Select.Content>
                            {instances.length === 0 ? (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    No credentials yet
                                </div>
                            ) : (
                                instances.map((c) => (
                                    <Select.Item key={c.id} value={c.id} className="text-xs">
                                        {c.name}
                                    </Select.Item>
                                ))
                            )}
                        </Select.Content>
                    </Select.Root>
                    {instanceId ? (
                        <FloatContainer className="shadow-sm! rounded-md! shadow-black/10!">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xxs"
                                className="my-auto"
                                onClick={() => instanceId && openEditDialog(instanceId)}
                            >
                                <SystemIcons.SquarePen/>
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xxs"
                                className="text-destructive my-auto"
                                onClick={() => setInstance(null)}
                            >
                                <SystemIcons.Trash />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xxs"
                                className="my-auto"
                                onClick={openAddDialog}
                            >
                                <SystemIcons.Plus />
                            </Button>
                        </FloatContainer>
                    ) : (
                        <Button type="button" variant="input" size="sm" onClick={openAddDialog}>
                            <SystemIcons.Plus /> Add
                        </Button>
                    )}
                </div>
            </div>
        );
    },
);

CredentialPicker.displayName = "CredentialPicker";
