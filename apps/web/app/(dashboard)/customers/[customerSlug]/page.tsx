"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/phone-input";
import { AddressInput } from "@/components/ui/address-input";
import { ChevronRight, Building2, User, Mail, Phone, MapPin, Briefcase, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createCustomerSchema } from "@construction/shared";
import type { ProjectStatus } from "@construction/shared";
import type { z } from "zod";

const projectStatusToVariant = (status: ProjectStatus) => {
  switch (status) {
    case "active": return "active" as const;
    case "on_hold": return "warning" as const;
    case "completed": return "completed" as const;
    case "archived": return "cancelled" as const;
    default: return "draft" as const;
  }
};

type CustomerFormData = z.infer<typeof createCustomerSchema>;

export default function CustomerDetailPage({
  params,
}: {
  params: { customerSlug: string };
}) {
  const { customerSlug } = params;
  const router = useRouter();
  const { data: customer, isLoading } = trpc.customer.getBySlug.useQuery({ slug: customerSlug });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
      address: { street1: "", street2: "", city: "", state: "", zipCode: "" },
    },
  });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: (updated) => {
      utils.customer.getBySlug.invalidate({ slug: customerSlug });
      utils.customer.list.invalidate();
      toast.success("Customer updated successfully");
      setEditDialogOpen(false);
      if (updated.slug && updated.slug !== customerSlug) {
        router.replace(`/customers/${updated.slug}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update customer");
    },
  });

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      toast.success("Customer deleted successfully");
      router.push("/customers");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete customer");
    },
  });

  const handleDelete = () => {
    if (!customer) return;
    if (confirm(`Are you sure you want to delete ${customer.companyName || customer.contactName}?`)) {
      deleteMutation.mutate({ id: customer.id });
    }
  };

  const handleEdit = () => {
    if (!customer) return;
    form.reset({
      companyName: customer.companyName || "",
      contactName: customer.contactName,
      phone: customer.phone || "",
      email: customer.email || "",
      address: {
        street1: customer.street1 || "",
        street2: customer.street2 || "",
        city: customer.city || "",
        state: customer.state || "",
        zipCode: customer.zip || "",
      },
    });
    setEditDialogOpen(true);
  };

  const handleSubmitEdit = (data: CustomerFormData) => {
    if (!customer) return;
    updateMutation.mutate({
      id: customer.id,
      companyName: data.companyName,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      street1: data.address?.street1,
      street2: data.address?.street2,
      city: data.address?.city,
      state: data.address?.state,
      zip: data.address?.zipCode,
    });
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
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold">Customer not found</h3>
          <p className="text-sm text-muted-foreground">
            The customer you're looking for doesn't exist.
          </p>
          <Button asChild>
            <Link href="/customers">Back to Customers</Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName = customer.companyName || customer.contactName;

  const formatAddress = (): string => {
    const parts = [
      customer.street1,
      customer.street2,
      customer.city,
      [customer.state, customer.zip].filter(Boolean).join(" "),
    ].filter(Boolean);
    return parts.join("\n");
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/customers" className="hover:text-foreground">
          Customers
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{displayName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {customer.companyName ? (
              <Building2 className="h-8 w-8 text-muted-foreground" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          </div>
          {customer.companyName && (
            <p className="text-muted-foreground">Contact: {customer.contactName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button variant="outline" asChild>
            <Link href="/customers">Back to Customers</Link>
          </Button>
        </div>
      </div>

      {/* Customer Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {customer.email && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">{customer.email}</div>
            </CardContent>
          </Card>
        )}

        {customer.phone && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Phone</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">{customer.phone}</div>
            </CardContent>
          </Card>
        )}

        {customer.street1 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Address</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm whitespace-pre-line">{formatAddress()}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customer.projectCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            All projects for this customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customer.projects && customer.projects.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {customer.projects.map((project: any) => (
                <Link key={project.id} href={`/projects/${project.slug || project.id}`}>
                  <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2">
                          {project.jobNumber && (
                            <>{project.jobNumber}-</>
                          )}
                          {project.name}
                        </CardTitle>
                        <StatusBadge variant={projectStatusToVariant(project.status as ProjectStatus)}>
                          {project.status.replace("_", " ")}
                        </StatusBadge>
                      </div>
                      {project.location && (
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {project.location}
                        </CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No projects yet for this customer</p>
              <Button asChild className="mt-4">
                <Link href="/projects/new">Create Project</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer information</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmitEdit)} className="space-y-4 py-4">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name (Optional)</FormLabel>
                  <FormControl><Input placeholder="ABC Construction Inc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contactName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name *</FormLabel>
                  <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><PhoneInput {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Address</h4>
                <AddressInput form={form} prefix="address" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
