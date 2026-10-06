import { Fragment, lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CircleGaugeIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  InboxIcon,
  MessagesSquareIcon,
  PlugZapIcon,
  PlusIcon,
  PaletteIcon,
  ShoppingBagIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UserRoundPlusIcon
} from "lucide-react";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { ApplicationLayout } from "@codexsun/ui/layouts/application-layout";
import { useAppBrand } from "../../shared/brand/app-brand";
import { BrandingWorkspace } from "../../modules/branding";
import type { SidemenuItem } from "@codexsun/ui/blocks/menu/sidemenu/sub/sidemenu-section";
import { AuthGate } from "../../shared/auth/AuthGate";
import { getToken } from "../../shared/api/platform-api";
import {
  crmInAppNotificationEvent,
  showCrmDesktopNotification,
  useBrowserNotificationPermission,
  useCrmCallNotificationPreference,
  useCrmEnquiriesQuery,
  useCrmOptionsQuery,
  useCrmOverviewQuery,
  type CrmEnquiry,
  type CrmEnquiryOverview,
  type CrmInAppNotification
} from "../../modules/crm";
import { markNotificationRead, useNotificationInboxQuery } from "../../modules/notification";
import { applicationEntryPath, canAccessAdministratorSettings } from "./app-shell-access";
import {
  countEnquiriesForFilter,
  buildCrmEnquiryListFilters,
  enquiryFilterFromUrl,
  type CrmEnquiryListFilter
} from "../../modules/crm/crm.enquiry-filters";
import { getHoneyAvailability } from "../../modules/honey";

const UserWorkspace = lazy(() =>
  import("../../modules/user").then((module) => ({ default: module.UserWorkspace }))
);
const RoleWorkspace = lazy(() =>
  import("../../modules/role").then((module) => ({ default: module.RoleWorkspace }))
);
const PermissionWorkspace = lazy(() =>
  import("../../modules/permission").then((module) => ({ default: module.PermissionWorkspace }))
);
const RolePermissionWorkspace = lazy(() =>
  import("../../modules/role-permission").then((module) => ({
    default: module.RolePermissionWorkspace
  }))
);
const UserProfileWorkspace = lazy(() =>
  import("../../modules/user/user.profile.workspace").then((module) => ({
    default: module.UserProfileWorkspace
  }))
);
const CrmOverview = lazy(() =>
  import("../../modules/crm").then((module) => ({ default: module.CrmOverview }))
);
const CrmWorkspace = lazy(() =>
  import("../../modules/crm").then((module) => ({ default: module.CrmWorkspace }))
);
const CrmEnquiryUpsertPage = lazy(() =>
  import("../../modules/crm").then((module) => ({ default: module.CrmEnquiryUpsertPage }))
);
const CrmEnquiryDesk = lazy(() =>
  import("../../modules/crm").then((module) => ({ default: module.CrmEnquiryDesk }))
);
const CrmReports = lazy(() =>
  import("../../modules/crm").then((module) => ({ default: module.CrmReports }))
);
const CrmNotificationSettings = lazy(() =>
  import("../../modules/crm").then((module) => ({ default: module.CrmNotificationSettings }))
);
const HrStaffRequestWorkspace = lazy(() =>
  import("../../modules/hr").then((module) => ({ default: module.HrStaffRequestWorkspace }))
);
const HrDutyWorkspace = lazy(() =>
  import("../../modules/hr").then((module) => ({ default: module.HrDutyWorkspace }))
);
const EstimateWorkspace = lazy(() =>
  import("../../modules/estimate").then((module) => ({ default: module.EstimateWorkspace }))
);
const FrappeOverview = lazy(() =>
  import("../../modules/frappe").then((module) => ({ default: module.FrappeOverview }))
);
const FrappeUserSyncWorkspace = lazy(() =>
  import("../../modules/frappe").then((module) => ({ default: module.FrappeUserSyncWorkspace }))
);
const HoneyWorkspace = lazy(() =>
  import("../../modules/honey").then((module) => ({ default: module.HoneyWorkspace }))
);
const AgentConnectorWorkspace = lazy(() =>
  import("../../modules/honey").then((module) => ({ default: module.AgentConnectorWorkspace }))
);
const SkillLibraryWorkspace = lazy(() =>
  import("../../modules/honey").then((module) => ({ default: module.SkillLibraryWorkspace }))
);
const TemaControlWorkspace = lazy(() =>
  import("../../modules/honey").then((module) => ({ default: module.TemaControlWorkspace }))
);
const IshopWorkspace = lazy(() =>
  import("../../modules/ishop").then((module) => ({ default: module.IshopWorkspace }))
);
const MessagingWorkspace = lazy(() =>
  import("../../modules/messaging").then((module) => ({ default: module.MessagingWorkspace }))
);
const DocsWorkspace = lazy(() =>
  import("../../modules/docs").then((module) => ({ default: module.DocsWorkspace }))
);
type Page =
  | "identity.users"
  | "identity.roles"
  | "identity.permissions"
  | "identity.access"
  | "identity.profile"
  | "app.branding"
  | "settings.frappe.overview"
  | "settings.frappe.users"
  | "settings.notifications"
  | "hr.my"
  | "hr.all"
  | "hr.duties"
  | "crm.overview"
  | "crm.assigned"
  | "crm.all"
  | "crm.created"
  | "crm.created.new"
  | "crm.enquiries"
  | "crm.open"
  | "crm.reports"
  | "estimate.list"
  | "ai.honey"
  | "ai.connector"
  | "ai.control"
  | "ai.skills"
  | "ishop.catalogs"
  | "ishop.categories"
  | "ishop.brands"
  | "ishop.products"
  | "ishop.items"
  | "ishop.variants"
  | "ishop.images"
  | "messaging.inbox"
  | "docs.index"
  | "docs.crm"
  | "docs.changelog";

type Claims = {
  email: string;
  frappeUser?: string;
  name?: string;
  permissions?: string[];
  role?: string;
};

type AppNotification = CrmInAppNotification;

function pagePath(page: Page) {
  if (page === "docs.index") return "/app/docs";
  const path = `/app/${page.replaceAll(".", "/")}`;
  return page === "crm.created" ? `${path}?status=all` : path;
}

export function AppDesk() {
  const brand = useAppBrand();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const claims = readClaims();
  const permissions = claims.permissions ?? [];
  const superAdmin = canAccessAdministratorSettings(claims.role);
  const canUseCrm =
    claims.role !== "super-admin" &&
    permissions.some(
      (permission) =>
        permission.startsWith("crm.") ||
        permission.startsWith("estimate.") ||
        permission.startsWith("quotation.")
    );
  const canViewCrmReports = permissions.includes("crm.report.view");
  const canViewAllEnquiries =
    claims.role === "admin" && permissions.includes("crm.enquiry.all.view");
  const canCreateEnquiry = permissions.includes("crm.enquiry.create");
  const canUseIshop = permissions.some((permission) => permission.startsWith("ishop."));
  // HR is available to each employee role. The API still evaluates each request against the
  // current database permissions, so this remains safe while an older browser token is active.
  const canUseHr = claims.role === "admin" || claims.role === "user";
  const canViewAllHr = claims.role === "admin";
  const canApproveHr = claims.role === "admin";
  const canManageCrmListActions = claims.role === "admin";
  const showCrmActivity = claims.role === "admin";
  const showCrmProperties = claims.role !== "manager" && claims.role !== "user";
  const [globalSearch, setGlobalSearch] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const notificationInbox = useNotificationInboxQuery(Boolean(getToken()));
  const temaAvailability = useQuery({
    enabled: Boolean(getToken()),
    queryFn: getHoneyAvailability,
    queryKey: ["honey", "availability"]
  });
  const temaEnabled = temaAvailability.data?.enabled !== false;
  const browserNotifications = useBrowserNotificationPermission();
  const notificationPreference = useCrmCallNotificationPreference();
  const inboxNotificationIds = useRef(new Set<number>());
  const notificationInboxInitialized = useRef(false);
  const [menuNavigationRevision, setMenuNavigationRevision] = useState(0);
  const requestedPage = pageFromPath(pathname, claims.role);
  const page = accessiblePage(
    requestedPage,
    superAdmin,
    canUseCrm,
    canCreateEnquiry,
    canViewAllEnquiries,
    canViewCrmReports,
    canUseHr,
    canViewAllHr,
    canUseIshop,
    temaEnabled
  );
  const crmOverviewQuery = useCrmOverviewQuery(
    (page.startsWith("crm.") && page !== "hr.duties") || page.startsWith("estimate.")
  );
  const crmAllEnquiriesQuery = useCrmEnquiriesQuery(
    { status: "all", view: "all" },
    { enabled: canViewAllEnquiries, poll: page === "crm.enquiries" }
  );
  const crmOptionsQuery = useCrmOptionsQuery(canViewAllEnquiries);
  const select = (next: Page) => {
    setMenuNavigationRevision((revision) => revision + 1);
    void navigate({ to: pagePath(next) });
  };
  const openAllEnquiries = (filters: {
    assignedToEmployee?: string;
    createdByEmployee?: string;
    enquiryGroup?: string;
    fromDate?: string;
    status: import("../../modules/crm/crm.types").CrmEnquiryStatusFilter;
    toDate?: string;
  }) => {
    const query = new URLSearchParams();
    if (filters.assignedToEmployee) query.set("assignedToEmployee", filters.assignedToEmployee);
    if (filters.createdByEmployee) query.set("createdByEmployee", filters.createdByEmployee);
    if (filters.enquiryGroup) query.set("enquiryGroup", filters.enquiryGroup);
    if (filters.fromDate) query.set("fromDate", filters.fromDate);
    query.set("status", filters.status);
    if (filters.toDate) query.set("toDate", filters.toDate);
    void navigate({ to: `/app/crm/all?${query}` });
  };
  const openNewEnquiry = () => void navigate({ to: "/app/crm/created/new" });
  const openEnquiryDesk = (status: CrmEnquiryListFilter) => {
    setMenuNavigationRevision((revision) => revision + 1);
    void navigate({ to: `/app/crm/enquiries?status=${status}` });
  };
  const allMenuItems = buildMenu(
    page,
    select,
    superAdmin,
    canUseCrm,
    canCreateEnquiry,
    canViewAllEnquiries,
    canViewCrmReports,
    canUseHr,
    canViewAllHr,
    canUseIshop,
    openEnquiryDesk,
    crmAllEnquiriesQuery.data,
    crmOverviewQuery.data?.stats,
    crmOptionsQuery.data?.statuses
  );
  const bottomMenuItems = allMenuItems.filter((item) => item.title === "Settings");
  const menuItems = allMenuItems.filter((item) => !bottomMenuItems.includes(item));

  useEffect(() => {
    if (page !== requestedPage) {
      void navigate({ replace: true, to: pagePath(page) });
    }
  }, [navigate, page, requestedPage]);

  useEffect(() => {
    const addNotification = (event: Event) => {
      const notification = (event as CustomEvent<AppNotification>).detail;
      if (!notification) return;
      setNotifications((current) =>
        [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 20)
      );
    };
    window.addEventListener(crmInAppNotificationEvent, addNotification);
    return () => window.removeEventListener(crmInAppNotificationEvent, addNotification);
  }, []);

  useEffect(() => {
    if (!notificationInbox.data) return;
    const newItems = notificationInbox.data.filter((notification) => {
      if (inboxNotificationIds.current.has(notification.id)) return false;
      inboxNotificationIds.current.add(notification.id);
      return true;
    });
    setNotifications((current) =>
      [...notificationInbox.data, ...current]
        .reduce<AppNotification[]>((items, notification) => {
          if (!items.some((item) => item.id === String(notification.id))) {
            items.push({ ...notification, id: String(notification.id) });
          }
          return items;
        }, [])
        .slice(0, 20)
    );
    if (
      notificationInboxInitialized.current &&
      notificationPreference.enabled &&
      browserNotifications.permission === "granted"
    ) {
      newItems.forEach((notification) =>
        showCrmDesktopNotification({ ...notification, id: String(notification.id) })
      );
    }
    notificationInboxInitialized.current = true;
  }, [browserNotifications.permission, notificationInbox.data, notificationPreference.enabled]);

  function handleLogout() {
    window.location.replace("/sa/refresh");
  }

  return (
    <AuthGate>
      <>
        <ApplicationLayout
          brand={{ subtitle: brand.tagline, title: brand.title }}
          bottomMenuItems={bottomMenuItems}
          globalSearchPlaceholder="Search CRM enquiries"
          globalSearchValue={globalSearch}
          headerTitle={titleFor(page)}
          menuItems={menuItems}
          notifications={notifications}
          onNotificationDismiss={(id) => {
            const notificationId = Number(id);
            if (Number.isInteger(notificationId)) void markNotificationRead(notificationId);
            setNotifications((current) => current.filter((notification) => notification.id !== id));
          }}
          onLogout={handleLogout}
          onGlobalSearchValueChange={setGlobalSearch}
          profileHref="/app/identity/profile"
          showHomeAction={false}
          showPageTitle={false}
          showSidebarUser={false}
          subtitle={null}
          title={null}
          user={{
            email: claims.email,
            fallback: initials(claims.name ?? claims.email),
            name: claims.name ?? claims.email
          }}
          versionLabel={`v ${__APP_VERSION__}`}
          workspaceItems={[
            ...(canUseCrm
              ? [
                  {
                    active: page.startsWith("crm.") || page.startsWith("estimate."),
                    description: "Live Frappe enquiry and estimate workflows.",
                    icon: MessagesSquareIcon,
                    title: "CRM",
                    url: "/app/crm/overview"
                  }
                ]
              : []),
            ...(superAdmin
              ? [
                  {
                    active:
                      (page.startsWith("identity.") && page !== "identity.profile") ||
                      page.startsWith("settings."),
                    description: "Identity, Frappe connection, and user credentials.",
                    icon: PlugZapIcon,
                    title: "Admin",
                    url: "/app/settings/frappe/overview"
                  }
                ]
              : [])
          ]}
        >
          <main className="w-full space-y-4 px-2 py-2 lg:px-3 lg:py-3">
            <Suspense fallback={<GlobalLoader />}>
              <Fragment key={`${page}-${menuNavigationRevision}`}>
                {renderPage(
                  page,
                  claims,
                  permissions,
                  superAdmin,
                  canUseCrm,
                  canUseHr,
                  canViewAllHr,
                  canApproveHr,
                  canManageCrmListActions,
                  showCrmActivity,
                  showCrmProperties,
                  globalSearch,
                  setGlobalSearch,
                  openAllEnquiries,
                  openNewEnquiry
                )}
              </Fragment>
            </Suspense>
          </main>
        </ApplicationLayout>
      </>
    </AuthGate>
  );
}

function renderPage(
  page: Page,
  claims: Claims,
  permissions: string[],
  superAdmin: boolean,
  canUseCrm: boolean,
  canUseHr: boolean,
  canViewAllHr: boolean,
  canApproveHr: boolean,
  canManageCrmListActions: boolean,
  showCrmActivity: boolean,
  showCrmProperties: boolean,
  globalSearch: string,
  onGlobalSearchValueChange: (value: string) => void,
  onOpenAllEnquiries: (filters: {
    assignedToEmployee?: string;
    enquiryGroup?: string;
    fromDate?: string;
    status: import("../../modules/crm/crm.types").CrmEnquiryStatusFilter;
    toDate?: string;
  }) => void,
  onCreateEnquiry: () => void
) {
  if (page === "ai.connector")
    return superAdmin ? <AgentConnectorWorkspace /> : <UserProfileWorkspace />;
  if (page === "ai.skills")
    return superAdmin ? <SkillLibraryWorkspace /> : <UserProfileWorkspace />;
  if (page === "ai.control")
    return superAdmin ? <TemaControlWorkspace /> : <UserProfileWorkspace />;
  if (page === "ai.honey") return <HoneyWorkspace />;
  if (isAdministratorPage(page) && !superAdmin) {
    return canUseCrm ? <CrmOverview userName={claims.name} /> : <UserProfileWorkspace />;
  }
  if (page === "identity.users") return <UserWorkspace actorEmail={claims.email} />;
  if (page === "identity.roles") return <RoleWorkspace />;
  if (page === "identity.permissions") return <PermissionWorkspace />;
  if (page === "identity.access") return <RolePermissionWorkspace />;
  if (page === "identity.profile") return <UserProfileWorkspace />;
  if (page === "app.branding") return superAdmin ? <BrandingWorkspace /> : <UserProfileWorkspace />;
  if (page === "settings.frappe.overview") {
    return <FrappeOverview canUpdate={permissions.includes("settings.frappe.update")} />;
  }
  if (page === "settings.frappe.users") {
    return (
      <FrappeUserSyncWorkspace
        canImport={
          permissions.includes("settings.frappe.update") &&
          permissions.includes("identity.user.create")
        }
      />
    );
  }
  if (page === "settings.notifications") return <CrmNotificationSettings />;
  if (page === "hr.my" || page === "hr.all") {
    return (
      <HrStaffRequestWorkspace
        canApprove={canApproveHr}
        canCreate={canUseHr}
        canUpdate={canUseHr}
        view={page === "hr.all" && canViewAllHr ? "all" : "my"}
      />
    );
  }
  if (page === "hr.duties") return <HrDutyWorkspace />;
  if (page === "crm.overview") {
    return <CrmOverview userName={claims.name} />;
  }
  if (page === "crm.enquiries") {
    return <CrmEnquiryDesk actorEmail={claims.email} />;
  }
  if (page === "crm.created.new") {
    return (
      <CrmEnquiryUpsertPage
        canAssign={permissions.includes("crm.enquiry.assign")}
        canUpdate={permissions.includes("crm.enquiry.update")}
        historyScope={claims.email}
      />
    );
  }
  if (page === "crm.reports") {
    return <CrmReports onOpenEnquiries={onOpenAllEnquiries} />;
  }
  if (page === "estimate.list") {
    return (
      <EstimateWorkspace
        canCreate={
          permissions.includes("estimate.create") || permissions.includes("crm.enquiry.create")
        }
        canUpdate={
          permissions.includes("estimate.update") || permissions.includes("crm.enquiry.update")
        }
      />
    );
  }
  if (page.startsWith("ishop.")) {
    return (
      <IshopWorkspace
        page={
          page.slice("ishop.".length) as import("../../modules/ishop/ishop.workspace").IshopPage
        }
      />
    );
  }
  if (page === "messaging.inbox") return <MessagingWorkspace actorEmail={claims.email} />;
  if (page.startsWith("docs.")) {
    return (
      <DocsWorkspace page={page.slice("docs.".length) as import("../../modules/docs").DocsPage} />
    );
  }
  if (!canUseCrm) return <UserProfileWorkspace />;
  const view =
    page === "crm.all"
      ? "all"
      : page === "crm.created"
        ? "created"
        : page === "crm.open"
          ? "open"
          : "assigned";
  return (
    <CrmWorkspace
      canAssign={permissions.includes("crm.enquiry.assign")}
      canCreate={page === "crm.created" && permissions.includes("crm.enquiry.create")}
      canCreateEstimate={
        permissions.includes("estimate.create") || permissions.includes("crm.enquiry.create")
      }
      canCreateQuotation={
        permissions.includes("quotation.create") || permissions.includes("crm.enquiry.create")
      }
      canForceDelete={permissions.includes("crm.enquiry.force-delete")}
      canManageJobs={permissions.includes("crm.job.manage")}
      canMobileLookup={page === "crm.created"}
      canRefresh={canManageCrmListActions}
      showActivity={showCrmActivity}
      showProperties={showCrmProperties}
      canSuspend={false}
      canUpdate={permissions.includes("crm.enquiry.update")}
      canUpdateEstimate={
        permissions.includes("estimate.update") || permissions.includes("crm.enquiry.update")
      }
      canUpdateQuotation={
        permissions.includes("quotation.update") || permissions.includes("crm.enquiry.update")
      }
      onSearchValueChange={onGlobalSearchValueChange}
      onCreate={onCreateEnquiry}
      searchValue={globalSearch}
      view={view}
    />
  );
}

function buildMenu(
  page: Page,
  select: (page: Page) => void,
  superAdmin: boolean,
  canUseCrm: boolean,
  canCreateEnquiry: boolean,
  canViewAllEnquiries: boolean,
  canViewCrmReports: boolean,
  canUseHr: boolean,
  canViewAllHr: boolean,
  canUseIshop: boolean,
  onOpenEnquiryDesk: (status: CrmEnquiryListFilter) => void,
  crmEnquiries?: CrmEnquiry[],
  crmStats?: CrmEnquiryOverview["stats"],
  crmStatusOptions?: Array<{ label: string; value: string }>
): SidemenuItem[] {
  const item = (title: string, target: Page, badge?: number) => ({
    ...(badge !== undefined ? { badge } : {}),
    isActive: page === target,
    onSelect: () => select(target),
    title
  });
  const notificationSettings = {
    icon: Settings2Icon,
    isActive: page.startsWith("settings."),
    items: [
      item("Desktop notifications", "settings.notifications"),
      ...(superAdmin
        ? [
            { ...item("Frappe connection", "settings.frappe.overview"), icon: CircleGaugeIcon },
            { ...item("Frappe Users", "settings.frappe.users"), icon: UserRoundPlusIcon }
          ]
        : [])
    ],
    title: "Settings"
  };
  if (canUseIshop && page.startsWith("ishop.")) {
    return [
      {
        icon: ShoppingBagIcon,
        isActive: true,
        items: [
          item("Catalogs", "ishop.catalogs"),
          item("Categories", "ishop.categories"),
          item("Brands", "ishop.brands"),
          item("Products", "ishop.products"),
          item("Product Details", "ishop.items"),
          item("Product Variants", "ishop.variants"),
          item("Product Images", "ishop.images")
        ],
        title: "LogicX iShop"
      },
      ...(canUseHr
        ? [
            {
              icon: CalendarDaysIcon,
              isActive: page === "hr.duties",
              onSelect: () => select("hr.duties"),
              title: "Duties"
            }
          ]
        : []),
      notificationSettings
    ];
  }
  if (canUseCrm && (!superAdmin || page.startsWith("crm.") || page.startsWith("estimate."))) {
    return [
      ...(canCreateEnquiry
        ? [
            {
              icon: PlusIcon,
              isActive: page === "crm.created.new",
              onSelect: () => select("crm.created.new"),
              prominent: true,
              title: "New enquiry"
            }
          ]
        : []),
      {
        icon: MessagesSquareIcon,
        isActive: true,
        items: [
          { ...item("Overview", "crm.overview"), icon: CircleGaugeIcon },
          item("My Job", "crm.assigned", crmStats?.myJob.total),
          {
            ...item("My Calls", "crm.created", crmStats?.myCalls.total),
            isActive: page === "crm.created" || page === "crm.created.new"
          },
          ...(canViewAllEnquiries
            ? [item("All Enquiries", "crm.all", crmStats?.allEnquiries?.total)]
            : []),
          ...(superAdmin ? [item("Open Enquiry", "crm.open")] : []),
          ...(canViewCrmReports ? [item("Reports", "crm.reports")] : [])
        ],
        title: "CRM"
      },
      ...(canViewAllEnquiries
        ? [enquiryDeskMenu(page, crmEnquiries ?? [], onOpenEnquiryDesk, crmStatusOptions)]
        : []),
      ...(canUseHr
        ? [
            {
              icon: CalendarDaysIcon,
              isActive: page === "hr.duties",
              onSelect: () => select("hr.duties"),
              title: "Duties"
            },
            {
              icon: ClipboardListIcon,
              isActive: page.startsWith("hr."),
              items: [
                item("My requests", "hr.my"),
                ...(canViewAllHr ? [item("All requests", "hr.all")] : [])
              ],
              title: "HR"
            }
          ]
        : []),
      notificationSettings
    ];
  }
  return [
    ...(canUseHr
      ? [
          {
            icon: CalendarDaysIcon,
            isActive: page === "hr.duties",
            onSelect: () => select("hr.duties"),
            title: "Duties"
          }
        ]
      : []),
    {
      icon: ShieldCheckIcon,
      isActive: page.startsWith("identity."),
      items: [
        item("Users", "identity.users"),
        item("Roles", "identity.roles"),
        item("Permissions", "identity.permissions"),
        item("Access controls", "identity.access")
      ],
      title: "Identity"
    },
    ...(superAdmin
      ? [
          {
            icon: PaletteIcon,
            isActive: page === "app.branding",
            onSelect: () => select("app.branding"),
            title: "App branding"
          }
        ]
      : []),
    notificationSettings
  ];
}

function enquiryDeskMenu(
  page: Page,
  records: CrmEnquiry[],
  onOpen: (filter: CrmEnquiryListFilter) => void,
  statusOptions?: Array<{ label: string; value: string }>
): SidemenuItem {
  const selectedFilter = page === "crm.enquiries" ? enquiryFilterFromUrl() : null;
  return {
    icon: InboxIcon,
    isActive: page === "crm.enquiries",
    items: buildCrmEnquiryListFilters(statusOptions).map((filter) => ({
      badge: countEnquiriesForFilter(records, filter.id),
      isActive: selectedFilter === filter.id,
      onSelect: () => onOpen(filter.id),
      title: filter.label
    })),
    title: "Enquiries"
  };
}

function accessiblePage(
  page: Page,
  superAdmin: boolean,
  canUseCrm: boolean,
  canCreateEnquiry: boolean,
  canViewAllEnquiries: boolean,
  canViewCrmReports: boolean,
  canUseHr: boolean,
  canViewAllHr: boolean,
  canUseIshop: boolean,
  temaEnabled: boolean
): Page {
  if (page === "ai.honey" && !temaEnabled)
    return superAdmin ? "ai.skills" : canUseCrm ? "crm.overview" : "identity.profile";
  if (isAdministratorPage(page) && !superAdmin)
    return canUseCrm ? "crm.overview" : "identity.profile";
  if (page === "crm.reports" && !canViewCrmReports)
    return canUseCrm ? "crm.overview" : "identity.profile";
  if (page === "crm.all" && !canViewAllEnquiries)
    return canUseCrm ? "crm.overview" : "identity.profile";
  if (page === "crm.enquiries" && !canViewAllEnquiries)
    return canUseCrm ? "crm.overview" : "identity.profile";
  if (page === "crm.created.new" && !canCreateEnquiry)
    return canUseCrm ? "crm.created" : "identity.profile";
  if (page === "hr.all" && !canViewAllHr)
    return canUseHr ? "hr.my" : canUseCrm ? "crm.overview" : "identity.profile";
  if (!canUseHr && page.startsWith("hr.")) return canUseCrm ? "crm.overview" : "identity.profile";
  if (!canUseCrm && (page.startsWith("crm.") || page === "estimate.list"))
    return "identity.profile";
  if (!canUseIshop && page.startsWith("ishop."))
    return canUseCrm ? "crm.overview" : "identity.profile";
  return page;
}

function isAdministratorPage(page: Page) {
  return (
    page === "crm.open" ||
    page === "ai.connector" ||
    page === "ai.control" ||
    page === "ai.skills" ||
    page === "app.branding" ||
    (page.startsWith("settings.") && page !== "settings.notifications") ||
    (page.startsWith("identity.") && page !== "identity.profile")
  );
}

function pageFromPath(pathname: string, role: string | undefined): Page {
  const value = pathname.replace(/^\/app\/?/u, "").replaceAll("/", ".");
  if (value === "docs") return "docs.index";
  const allowed: Page[] = [
    "identity.users",
    "identity.roles",
    "identity.permissions",
    "identity.access",
    "identity.profile",
    "app.branding",
    "settings.frappe.overview",
    "settings.frappe.users",
    "settings.notifications",
    "hr.my",
    "hr.all",
    "hr.duties",
    "crm.overview",
    "crm.assigned",
    "crm.all",
    "crm.created",
    "crm.created.new",
    "crm.enquiries",
    "crm.open",
    "crm.reports",
    "estimate.list",
    "ai.honey",
    "ai.connector",
    "ai.control",
    "ai.skills",
    "ishop.catalogs",
    "ishop.categories",
    "ishop.brands",
    "ishop.products",
    "ishop.items",
    "ishop.variants",
    "ishop.images",
    "messaging.inbox",
    "docs.crm",
    "docs.changelog"
  ];
  if (allowed.includes(value as Page)) return value as Page;
  return applicationEntryPath(role)
    .replace(/^\/app\//u, "")
    .replaceAll("/", ".") as Page;
}

function titleFor(page: Page) {
  const labels: Partial<Record<Page, string>> = {
    "crm.assigned": "My Job",
    "crm.all": "All Enquiries",
    "crm.created": "My Calls",
    "crm.created.new": "New enquiry",
    "crm.enquiries": "Enquiries",
    "crm.open": "Open Enquiry",
    "crm.reports": "Enquiry reports",
    "hr.my": "My requests",
    "hr.all": "All requests",
    "hr.duties": "Duties",
    "estimate.list": "Estimate",
    "settings.frappe.overview": "Frappe connection",
    "settings.frappe.users": "Frappe Users",
    "settings.notifications": "Desktop notifications",
    "app.branding": "App branding",
    "ai.honey": "TEMA AI",
    "ai.connector": "Agent Connector",
    "ai.control": "TEMA control",
    "ai.skills": "TEMA Skills",
    "ishop.catalogs": "Catalogs",
    "ishop.categories": "Categories",
    "ishop.brands": "Brands",
    "ishop.products": "Products",
    "ishop.items": "Product Details",
    "ishop.variants": "Product Variants",
    "ishop.images": "Product Images",
    "messaging.inbox": "Messaging",
    "docs.index": "Docs",
    "docs.crm": "Use CRM",
    "docs.changelog": "Changelog"
  };
  if (labels[page]) return labels[page];
  return page
    .split(".")
    .at(-1)!
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function readClaims(): Claims {
  const token = getToken();
  if (!token) return { email: "" };
  try {
    const encoded = token.split(".")[1] ?? "";
    return JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))) as Claims;
  } catch {
    return { email: "" };
  }
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
