export type NotificationInboxItem = {
  body: string;
  createdAt: string;
  id: number;
  resourceId: string;
  title: string;
  type: "assignment" | "comment" | "reply" | "status";
};
