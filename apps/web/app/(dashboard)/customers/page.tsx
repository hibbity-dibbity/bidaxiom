"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Edit, Trash2, Building2, User, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createCustomerSchema } from "@construction/shared";
import type { Customer } from "@construction/shared";
import type { z } from "zod";

type CustomerFormData = z.infer<typeof createCustomerSchema>;

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
      address: {
        street1: "",
        street2: "",
        city: "",
        state: "",
        zipCode: "",
      },
    },
  });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.customer.list.useQuery({
    search,
    limit: 100,
    offset: 0,
  });

  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      toast.success("Customer created successfully");
      setAddDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create customer");
    },
  });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      toast.success("Customer updated successfully");
      setEditDialogOpen(false);
      form.reset();
      setSelectedCustomer(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update customer");
    },
  });

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      toast.success("Customer deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete customer");
    },
  });

  const handleAdd = () => {
    form.reset({
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
      address: {
        street1: "",
        street2: "",
        city: "",
        state: "",
        zipCode: "",
      },
    });
    setSelectedCustomer(null);
    setAddDialogOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
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

  const handleDelete = (customer: Customer) => {
    if (confirm(`Are you sure you want to delete ${customer.companyName || customer.contactName}?`)) {
      deleteMutation.mutate({ id: customer.id });
    }
  };

  const handleSubmitAdd = (data: CustomerFormData) => {
    // Map form data to API schema (flatten address)
    const payload = {
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
    };
    createMutation.mutate(payload);
  };

  const handleSubmitEdit = (data: CustomerFormData) => {
    if (!selectedCustomer) return;

    const payload = {
      id: selectedCustomer.id,
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
    };
    updateMutation.mutate(payload);
  };

  const formatAddress = (customer: Customer): string => {
    const parts = [
      customer.street1,
      customer.city,
      [customer.state, customer.zip].filter(Boolean).join(" "),
    ].filter(Boolean);
    return parts.join(", ");
  };

  const customers = data?.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customers and clients
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search customers by name, company, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Customers Table */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : customers.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/customers/${customer.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {customer.companyName ? (
                        <>
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{customer.companyName}</span>
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{customer.contactName}</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{customer.contactName}</TableCell>
                  <TableCell>
                    {customer.email && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {customer.phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {customer.street1 && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1">{formatAddress(customer)}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(customer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(customer)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="rounded-full bg-muted p-3">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No customers yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first customer to get started
              </p>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </Card>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>
              Create a new customer record
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmitAdd)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC Construction Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <PhoneInput {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Address</h4>
                <AddressInput form={form} prefix="address" />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Customer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmitEdit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC Construction Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <PhoneInput {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
