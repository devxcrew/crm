import { useDeferredValue, useState } from "react";
import { ArrowLeft, Check, LoaderCircle, Search, Users } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { useMessagingMutations, useMessagingUserPickerQuery } from "./messaging.hooks";
import type { MessagingContact } from "./messaging.types";

export function NewConversationComposer({ onCreated, onCancel }: { onCancel: () => void; onCreated: (conversationId: number) => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selected, setSelected] = useState<MessagingContact[]>([]);
  const [error, setError] = useState("");
  const contacts = useMessagingUserPickerQuery(useDeferredValue(search));
  const mutations = useMessagingMutations();
  const choose = async (contact: MessagingContact) => {
    if (groupMode) { setSelected((current) => current.some((item) => item.id === contact.id) ? current.filter((item) => item.id !== contact.id) : [...current, contact]); return; }
    try {
      setError("");
      const conversation = await mutations.createConversation.mutateAsync({ memberIds: [contact.id], title: null, type: "DIRECT" });
      await onCreated(conversation.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The chat could not be created.");
    }
  };
  const createGroup = async () => {
    if (!groupTitle.trim() || selected.length < 2) return;
    try {
      setError("");
      const conversation = await mutations.createConversation.mutateAsync({ memberIds: selected.map((item) => item.id), title: groupTitle.trim(), type: "GROUP" });
      await onCreated(conversation.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The group could not be created.");
    }
  };
  return <div className="flex h-full flex-col">
    <div className="flex h-[64px] items-center gap-2 border-b px-3"><Button aria-label="Back to chats" onClick={onCancel} size="icon" type="button" variant="ghost"><ArrowLeft className="size-5" /></Button><h2 className="flex-1 text-base font-semibold">{groupMode ? "New group" : "New chat"}</h2>{!groupMode ? <Button className="gap-2" onClick={() => setGroupMode(true)} size="sm" type="button" variant="ghost"><Users className="size-4" /> Group</Button> : null}</div>
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      {groupMode ? <Input autoFocus className="h-10 rounded-xl" onChange={(event) => setGroupTitle(event.target.value)} placeholder="Group name" value={groupTitle} /> : null}
      {selected.length ? <div className="flex flex-wrap gap-1.5">{selected.map((contact) => <button className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary" key={contact.id} onClick={() => void choose(contact)} type="button">{contact.name} ×</button>)}</div> : null}
      <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus={!groupMode} className="h-10 rounded-full border-0 bg-muted pl-9 shadow-none" onChange={(event) => setSearch(event.target.value)} placeholder="Search people" value={search} /></label>
      {error ? <p className="px-2 text-sm text-destructive">{error}</p> : null}
      <div className="min-h-0 flex-1 overflow-y-auto" role="listbox">{contacts.isFetching && !contacts.data?.length ? <p className="p-5 text-center text-sm text-muted-foreground">Finding people…</p> : null}{!contacts.isFetching && !contacts.data?.length ? <p className="p-5 text-center text-sm text-muted-foreground">No matching people</p> : null}{(contacts.data ?? []).map((contact) => { const checked = selected.some((item) => item.id === contact.id); return <button aria-selected={checked} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted" key={contact.id} onClick={() => void choose(contact)} role="option" type="button"><ContactAvatar name={contact.name} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{contact.name}</span><span className="block truncate text-xs text-muted-foreground">{contact.email}</span></span>{checked ? <Check className="size-4 text-primary" /> : null}</button>; })}</div>
      {groupMode ? <Button disabled={!groupTitle.trim() || selected.length < 2 || mutations.createConversation.isPending} onClick={() => void createGroup()} type="button">{mutations.createConversation.isPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}Create group</Button> : null}
    </div>
  </div>;
}

function ContactAvatar({ name }: { name: string }) { const initials = name.split(/\s+/u).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); return <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials || "?"}</span>; }
