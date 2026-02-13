"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, Calendar, DollarSign, Users, FileText, Edit, UserPlus, X, CheckCircle2, Circle, Clock, Building2, User, Mail, Phone, MapPin, Plus, Info } from "lucide-react";
import type { ProjectStatus, ProjectRole } from "@construction/shared";
import { useState } from "react";
import { toast } from "sonner";
import { getCustomerDisplayName } from "@construction/shared";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CSI_DIVISIONS = [
  {
    value: 0,
    label: "00 - Procurement and Contracting",
    description: "Bidding requirements, contract forms, conditions of the contract, and project procurement procedures"
  },
  {
    value: 1,
    label: "01 - General Requirements",
    description: "Project management, temporary facilities, quality control, project meetings, and submittal procedures"
  },
  {
    value: 2,
    label: "02 - Existing Conditions",
    description: "Demolition, site remediation, asbestos abatement, existing structure assessments, and hazardous material removal"
  },
  {
    value: 3,
    label: "03 - Concrete",
    description: "Cast-in-place concrete, precast concrete, concrete finishing, formwork, and concrete accessories"
  },
  {
    value: 4,
    label: "04 - Masonry",
    description: "Brick masonry, stone masonry, concrete block (CMU), glass block, and mortar"
  },
  {
    value: 5,
    label: "05 - Metals",
    description: "Structural steel, metal joists, metal decking, cold-formed metal framing, and ornamental metals"
  },
  {
    value: 6,
    label: "06 - Wood, Plastics, and Composites",
    description: "Rough carpentry, finish carpentry, architectural woodwork, plastic fabrications, and composite materials"
  },
  {
    value: 7,
    label: "07 - Thermal and Moisture Protection",
    description: "Waterproofing, insulation, roofing, siding, membrane roofing, and joint sealants"
  },
  {
    value: 8,
    label: "08 - Openings",
    description: "Doors, windows, skylights, glazing, curtain walls, and specialty openings"
  },
  {
    value: 9,
    label: "09 - Finishes",
    description: "Drywall, tile, flooring, carpet, painting, wallcovering, and acoustical ceilings"
  },
  {
    value: 10,
    label: "10 - Specialties",
    description: "Toilet partitions, fire extinguishers, signage, lockers, flagpoles, and building specialties"
  },
  {
    value: 21,
    label: "21 - Fire Suppression",
    description: "Fire sprinkler systems, standpipes, fire pumps, and fire suppression equipment"
  },
  {
    value: 22,
    label: "22 - Plumbing",
    description: "Plumbing fixtures, domestic water piping, sanitary waste, water heaters, and sewage systems"
  },
  {
    value: 23,
    label: "23 - HVAC",
    description: "Heating systems, ventilation, air conditioning, ductwork, fans, and climate control equipment"
  },
  {
    value: 26,
    label: "26 - Electrical",
    description: "Power distribution, lighting systems, fire alarm, emergency power, and electrical equipment"
  },
  {
    value: 27,
    label: "27 - Communications",
    description: "Data cabling, structured cabling, phone systems, audio/visual, and telecommunications infrastructure"
  },
  {
    value: 28,
    label: "28 - Electronic Safety and Security",
    description: "Access control systems, CCTV surveillance, intrusion detection, and building security systems"
  },
  {
    value: 31,
    label: "31 - Earthwork",
    description: "Excavation, grading, soil stabilization, trenching, and earthwork operations"
  },
  {
    value: 32,
    label: "32 - Exterior Improvements",
    description: "Paving, landscaping, fencing, retaining walls, site improvements, and irrigation"
  },
  {
    value: 33,
    label: "33 - Utilities",
    description: "Water distribution, sanitary sewers, storm drainage, and underground utility systems"
  },
];

const statusColors: Record<ProjectStatus, string> = {
  active: "bg-green-500/10 text-green-700 border-green-200",
  on_hold: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  completed: "bg-blue-500/10 text-blue-700 border-blue-200",
  archived: "bg-gray-500/10 text-gray-700 border-gray-200",
};

const phaseStatusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
};

const phaseStatusColors = {
  pending: "text-gray-400",
  in_progress: "text-blue-500",
  completed: "text-green-500",
};

export default function ProjectDashboardPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [inviteUserOpen, setInviteUserOpen] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<ProjectRole>("viewer");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editJobNumber, setEditJobNumber] = useState("");
  const [editProjectType, setEditProjectType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editCostCodes, setEditCostCodes] = useState<number[]>([]);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
  });

  const utils = trpc.useUtils();
  const { data: project, isLoading } = trpc.project.getById.useQuery({ id: projectId });
  const { data: companyProfile } = trpc.company.getCurrent.useQuery();
  const { data: customersData, isLoading: customersLoading, error: customersError } = trpc.customer.list.useQuery({ limit: 100, offset: 0 });
  const { data: usersData } = trpc.user.list.useQuery({ limit: 100, offset: 0 });
  const { data: budgetSummary } = trpc.budget.getProjectSummary.useQuery({ projectId });
  const { data: changeOrders } = trpc.changeOrder.list.useQuery({ projectId });
  const { data: paymentAppSummary } = trpc.paymentApp.getSummary.useQuery({ projectId });
  const { data: sovItems } = trpc.sov.list.useQuery({ projectId });
  const { data: retainage } = trpc.paymentApp.getRetainage.useQuery({ projectId });

  // Debug: Log project and customer data
  useEffect(() => {
    if (project) {
      console.log("🔍 Project Detail - Project data:", {
        id: project.id,
        name: project.name,
        jobNumber: project.jobNumber,
        hasJobNumber: !!project.jobNumber,
        customerId: project.customerId
      });

      if (!project.jobNumber) {
        console.warn("⚠️ Project has NO job number:", project.name);
      }
    }
  }, [project]);

  // Debug: Log customers data
  useEffect(() => {
    console.log("🔍 Customers data:", {
      hasData: !!customersData,
      itemsCount: customersData?.items?.length || 0,
      items: customersData?.items || []
    });
  }, [customersData]);

  const updateProjectMutation = trpc.project.update.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId });
      toast.success("Project updated");
      setEditProjectOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update project");
    },
  });

  const addTeamMemberMutation = trpc.project.addTeamMember.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId });
      toast.success("Team member added");
      setAddMemberOpen(false);
      setNewMemberUserId("");
      setNewMemberRole("viewer");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add team member");
    },
  });

  const removeTeamMemberMutation = trpc.project.removeTeamMember.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId });
      toast.success("Team member removed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove team member");
    },
  });

  const createCustomerMutation = trpc.customer.create.useMutation({
    onSuccess: (data) => {
      utils.customer.list.invalidate();
      setEditCustomerId(data.id);
      toast.success("Customer created");
      setAddCustomerOpen(false);
      setNewCustomer({ companyName: "", contactName: "", phone: "", email: "", address: "" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create customer");
    },
  });

  const inviteUserMutation = trpc.user.invite.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      toast.success("Invitation sent successfully");
      setInviteUserOpen(false);
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const { data: auditData } = trpc.audit.entityHistory.useQuery(
    {
      entityType: "Project",
      entityId: projectId,
    },
    {
      enabled: !!project,
    }
  );

  // Show only last 10 entries
  const recentAudit = auditData?.slice(0, 10) || [];

  const handleAddMember = () => {
    if (!newMemberUserId.trim()) {
      toast.error("User ID is required");
      return;
    }
    addTeamMemberMutation.mutate({
      projectId,
      userId: newMemberUserId,
      role: newMemberRole,
    });
  };

  const handleRemoveMember = (userId: string) => {
    if (confirm("Are you sure you want to remove this team member?")) {
      removeTeamMemberMutation.mutate({
        projectId,
        userId,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold">Project not found</h3>
          <p className="text-sm text-muted-foreground">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button asChild>
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {project.jobNumber && (
                <>{project.jobNumber}-</>
              )}
              {project.name}
            </h1>
            <Badge className={statusColors[project.status as ProjectStatus]} variant="outline">
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          {project.location && (
            <p className="text-muted-foreground mt-1">{project.location}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditName(project.name);
            setEditDescription(project.description || "");
            setEditLocation(project.location || "");
            setEditJobNumber(project.jobNumber || "");
            setEditProjectType(project.projectType);
            setEditStatus(project.status);
            setEditStartDate(project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "");
            setEditEndDate(project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "");
            setEditCustomerId(project.customerId);
            setEditCostCodes(project.costCodes || []);
            setEditProjectOpen(true);
          }}
        >
          <Edit className="mr-2 h-4 w-4" />
          Edit Project
        </Button>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Project name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-job-number">Job Number</Label>
              <Input
                id="edit-job-number"
                value={editJobNumber}
                onChange={(e) => setEditJobNumber(e.target.value)}
                placeholder={companyProfile?.jobNumberSettings?.template || "Enter job number"}
                className="font-mono"
                maxLength={50}
              />
              {companyProfile?.jobNumberSettings?.enabled && companyProfile.jobNumberSettings.template && (
                <p className="text-xs text-muted-foreground">
                  Must match format: {companyProfile.jobNumberSettings.template}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-customer">Customer</Label>
              <div className="flex gap-2">
                <SearchableSelect
                  options={
                    customersData?.items.map((customer) => ({
                      value: customer.id,
                      label: getCustomerDisplayName(customer),
                    })) || []
                  }
                  value={editCustomerId}
                  onValueChange={setEditCustomerId}
                  placeholder="Select customer"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAddCustomerOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Project description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="123 Main St, City, State"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-project-type">Project Type</Label>
                <Select value={editProjectType} onValueChange={setEditProjectType}>
                  <SelectTrigger id="edit-project-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-date">Start Date</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-end-date">End Date</Label>
                <Input
                  id="edit-end-date"
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* CSI Cost Codes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>CSI Cost Codes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (editCostCodes.length === CSI_DIVISIONS.length) {
                      setEditCostCodes([]);
                    } else {
                      setEditCostCodes(CSI_DIVISIONS.map((d) => d.value));
                    }
                  }}
                >
                  {editCostCodes.length === CSI_DIVISIONS.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <TooltipProvider>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-md p-3">
                  {CSI_DIVISIONS.map((division) => (
                    <div key={division.value} className="flex items-start space-x-3">
                      <Checkbox
                        checked={editCostCodes.includes(division.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditCostCodes([...editCostCodes, division.value]);
                          } else {
                            setEditCostCodes(editCostCodes.filter((v) => v !== division.value));
                          }
                        }}
                      />
                      <div className="flex items-center gap-1.5 flex-1">
                        <Label className="text-sm font-normal cursor-pointer">
                          {division.label}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{division.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProjectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editCustomerId) {
                  toast.error("Customer is required");
                  return;
                }
                updateProjectMutation.mutate({
                  id: projectId,
                  name: editName,
                  jobNumber: editJobNumber || null,
                  customerId: editCustomerId,
                  description: editDescription || null,
                  location: editLocation || null,
                  projectType: editProjectType as any,
                  status: editStatus as any,
                  startDate: editStartDate ? new Date(editStartDate).toISOString() : null,
                  endDate: editEndDate ? new Date(editEndDate).toISOString() : null,
                  costCodes: editCostCodes,
                });
              }}
              disabled={updateProjectMutation.isPending}
            >
              {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Navigation */}
      <div className="border-b">
        <nav className="flex gap-6 overflow-x-auto">
          <Link
            href={`/projects/${projectId}`}
            className="border-b-2 border-primary py-3 text-sm font-medium"
          >
            Overview
          </Link>
          <Link
            href={`/projects/${projectId}/documents`}
            className="border-b-2 border-transparent py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Documents
          </Link>
          <Link
            href={`/projects/${projectId}/budget`}
            className="border-b-2 border-transparent py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Budget
          </Link>
          <Link
            href={`/projects/${projectId}/commitments`}
            className="border-b-2 border-transparent py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Commitments
          </Link>
          <Link
            href={`/projects/${projectId}/change-orders`}
            className="border-b-2 border-transparent py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Change Orders
          </Link>
          <Link
            href={`/projects/${projectId}/sov`}
            className="border-b-2 border-transparent py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Schedule of Values
          </Link>
          <Link
            href={`/projects/${projectId}/payment-apps`}
            className="border-b-2 border-transparent py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Payment Apps
          </Link>
          <Link
            href={`/projects/${projectId}/invoices`}
            className="border-b-2 border-transparent py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Invoices
          </Link>
        </nav>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {budgetSummary ? (
              <>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(budgetSummary.totalBudgeted)}
                </div>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={`/projects/${projectId}/budget`}>
                    View budget details
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">--</div>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={`/projects/${projectId}/budget`}>
                    Set up budget
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schedule</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {project.startDate && project.endDate
                ? `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.endDate).toLocaleDateString()}`
                : "Not set"}
            </div>
            <p className="text-xs text-muted-foreground">
              {project.startDate && project.endDate
                ? `${Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24))} days`
                : "Set start and end dates"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.teamMembers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link href={`/projects/${projectId}/documents`}>View documents</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Change Orders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {changeOrders ? (
              <>
                <div className="text-2xl font-bold">
                  {changeOrders.filter((co) => co.status === "pending_approval" || co.status === "pco_submitted").length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pending ({changeOrders.filter((co) => co.status === "approved").length} approved)
                </p>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={`/projects/${projectId}/change-orders`}>View change orders</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">--</div>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={`/projects/${projectId}/change-orders`}>Create change order</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SOV</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {sovItems && sovItems.items.length > 0 ? (
              <>
                <div className="text-2xl font-bold">{sovItems.items.length}</div>
                <p className="text-xs text-muted-foreground">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(
                    sovItems.items.reduce((sum, item) => sum + Number(item.scheduledValue), 0)
                  )}{" "}
                  scheduled
                </p>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={`/projects/${projectId}/sov`}>Manage SOV</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">--</div>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={`/projects/${projectId}/sov`}>Set up SOV</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Apps</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {paymentAppSummary ? (
              <>
                <div className="text-2xl font-bold">
                  {paymentAppSummary.counts.submitted + paymentAppSummary.counts.underReview}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pending ({paymentAppSummary.counts.approved} approved)
                </p>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={`/projects/${projectId}/payment-apps`}>View payment apps</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">--</div>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={`/projects/${projectId}/payment-apps`}>Create payment app</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retainage</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {retainage ? (
              <>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(Number(retainage.summary.totalHeld))}
                </div>
                <p className="text-xs text-muted-foreground">Total held</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">$0</div>
                <p className="text-xs text-muted-foreground">No retainage</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Information */}
      {project.customer && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Customer Information</CardTitle>
                <CardDescription>Details about the project customer</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/customers/${project.customer.id}`}>
                  View Customer Portal
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-3">
                {project.customer.companyName ? (
                  <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                ) : (
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <p className="text-base font-semibold">
                    {getCustomerDisplayName(project.customer)}
                  </p>
                  {project.customer.companyName && (
                    <p className="text-xs text-muted-foreground">Contact: {project.customer.contactName}</p>
                  )}
                </div>
              </div>

              {project.customer.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="text-base">{project.customer.phone}</p>
                  </div>
                </div>
              )}

              {project.customer.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-base">{project.customer.email}</p>
                  </div>
                </div>
              )}

              {project.customer.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <p className="text-base">{project.customer.address}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>People assigned to this project</CardDescription>
            </div>
            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>
                    Assign a team member to this project
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-select">Team Member</Label>
                    <div className="flex gap-2">
                      <SearchableSelect
                        options={
                          usersData?.items.map((user) => ({
                            value: user.clerkUserId,
                            label: user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName} (${user.email})`
                              : user.email,
                          })) || []
                        }
                        value={newMemberUserId}
                        onValueChange={setNewMemberUserId}
                        placeholder="Select team member"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setAddMemberOpen(false);
                          setInviteUserOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Project Role</Label>
                    <Select value={newMemberRole} onValueChange={(value) => setNewMemberRole(value as ProjectRole)}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="project_manager">Project Manager</SelectItem>
                        <SelectItem value="superintendent">Superintendent</SelectItem>
                        <SelectItem value="foreman">Foreman</SelectItem>
                        <SelectItem value="estimator">Estimator</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddMember} disabled={addTeamMemberMutation.isPending}>
                    {addTeamMemberMutation.isPending ? "Adding..." : "Add Member"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {project.teamMembers && project.teamMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.teamMembers.map((member: any) => (
                  <TableRow key={member.userId}>
                    <TableCell className="font-medium">
                      {member.firstName && member.lastName
                        ? `${member.firstName} ${member.lastName}`
                        : member.email || member.userId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.role.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(member.assignedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.userId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No team members assigned yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Phases Section */}
      <Card>
        <CardHeader>
          <CardTitle>Project Phases</CardTitle>
          <CardDescription>Construction phases and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {project.phases && project.phases.length > 0 ? (
            <div className="space-y-3">
              {project.phases.map((phase: any) => {
                const StatusIcon = phaseStatusIcons[phase.status as keyof typeof phaseStatusIcons] || Circle;
                const statusColor = phaseStatusColors[phase.status as keyof typeof phaseStatusColors] || "text-gray-400";

                return (
                  <div key={phase.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                      <div>
                        <p className="font-medium">{phase.name}</p>
                        {(phase.startDate || phase.endDate) && (
                          <p className="text-xs text-muted-foreground">
                            {phase.startDate ? new Date(phase.startDate).toLocaleDateString() : "TBD"}
                            {" - "}
                            {phase.endDate ? new Date(phase.endDate).toLocaleDateString() : "TBD"}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {phase.status.replace("_", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No phases defined
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest changes to this project</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAudit.length > 0 ? (
            <div className="space-y-3">
              {recentAudit.map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">
                      {entry.action.replace("_", " ")} {entry.entityType.toLowerCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No activity yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>
              Create a new customer record
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-company">Company Name (Optional)</Label>
              <Input
                id="add-company"
                value={newCustomer.companyName}
                onChange={(e) => setNewCustomer({ ...newCustomer, companyName: e.target.value })}
                placeholder="ABC Construction Inc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-contact">Contact Name *</Label>
              <Input
                id="add-contact"
                value={newCustomer.contactName}
                onChange={(e) => setNewCustomer({ ...newCustomer, contactName: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-phone">Phone</Label>
                <Input
                  id="add-phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-address">Address</Label>
              <Textarea
                id="add-address"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                placeholder="123 Main St, City, State, ZIP"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddCustomerOpen(false);
                setNewCustomer({ companyName: "", contactName: "", phone: "", email: "", address: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newCustomer.contactName.trim()) {
                  toast.error("Contact name is required");
                  return;
                }
                createCustomerMutation.mutate(newCustomer);
              }}
              disabled={createCustomerMutation.isPending}
            >
              {createCustomerMutation.isPending ? "Creating..." : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={inviteUserOpen} onOpenChange={setInviteUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to a new user to join your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">First Name</Label>
                <Input
                  id="invite-first-name"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Last Name</Label>
                <Input
                  id="invite-last-name"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteUserOpen(false);
                setInviteEmail("");
                setInviteFirstName("");
                setInviteLastName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!inviteEmail.trim()) {
                  toast.error("Email is required");
                  return;
                }
                inviteUserMutation.mutate({
                  email: inviteEmail,
                  firstName: inviteFirstName || undefined,
                  lastName: inviteLastName || undefined,
                });
              }}
              disabled={inviteUserMutation.isPending}
            >
              {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
