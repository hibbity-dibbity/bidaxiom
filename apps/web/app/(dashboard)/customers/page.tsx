"use client";

import { useAuth } from "@/lib/auth-context";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ListToolbar, ListActions, SearchField } from "@/components/shared/list-toolbar";
import { downloadCsv } from "@/lib/csv";
import { MobileSort } from "@/components/shared/mobile-sort";
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
import { PaymentTermsField } from "@/components/customers/payment-terms-field";
import { Upload, Plus, ChevronRight, Building2, User, Mail, Phone, MapPin, ChevronsUpDown, ChevronUp, ChevronDown, Search, SearchX } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { customerFormSchema, toCustomerPayload, type CustomerFormData } from "@/lib/customer-form";
import type { Customer } from "@construction/shared";
import type { z } from "zod";


export default function CustomersPage() {
  const { orgRole } = useAuth();
  if (orgRole && !["org:admin", "org:project_manager", "org:accountant", "org:estimator"].includes(orgRole)) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">Your role cannot view customers.</p>
      </div>
    );
  }
  return <CustomersList />;
}

function CustomersList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  // Sorting happens on the server so it covers every customer, not just the page on screen.
  const [sorting, setSortingState] = React.useState<SortingState>([{ id: "customer", desc: false }]);
  const setSorting = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    setSortingState((old) => (typeof updater === "function" ? updater(old) : updater));
    setPage(1);
  };

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
      paymentTerms: "",
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
    sortBy: ((): "customer" | "contactName" | "email" => (sorting[0]?.id === "contactName" || sorting[0]?.id === "email" ? sorting[0].id : "customer"))(),
    sortOrder: sorting[0]?.desc ? "desc" : "asc",
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
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

  const handleAdd = () => {
    form.reset({
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
      paymentTerms: "",
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
      paymentTerms: customer.paymentTerms || "",
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

  const handleSubmitAdd = (data: CustomerFormData) => {
    // Map form data to API schema (flatten address)
    const payload = {
      ...toCustomerPayload(data),
    };
    createMutation.mutate(payload);
  };

  const handleSubmitEdit = (data: CustomerFormData) => {
    if (!selectedCustomer) return;

    const payload = {
      id: selectedCustomer.id,
      ...toCustomerPayload(data),
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

  const columns = React.useMemo(() => [
    {
      id: "customer",
      accessorFn: (row: Customer) => row.companyName || row.contactName,
      header: "Customer",
      enableSorting: true,
    },
    {
      accessorKey: "contactName",
      header: "Contact",
      enableSorting: true,
    },
    {
      accessorKey: "email",
      header: "Email",
      enableSorting: true,
    },
    {
      accessorKey: "phone",
      header: "Phone",
      enableSorting: false,
    },
    {
      id: "address",
      header: "Address",
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
    },
  ], []);

  const table = useReactTable({
    data: customers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSortingRemoval: false,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customers and clients"
      />

      <ListToolbar
        activeCount={search.trim() ? 1 : 0}
        summary={data ? `${Number(data.total ?? 0)} shown` : undefined}
        actions={
          <ListActions
            onAdd={handleAdd}
            importHref="/customers/import"
            exportDisabled={customers.length === 0}
            onExport={() => downloadCsv("customers", ["Customer", "Contact", "Email", "Phone", "Address"], customers.map((c: Customer) => [c.companyName || c.contactName, c.contactName, c.email, c.phone, [c.street1, c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")]))}
          />
        }
      >
        <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, company or email" />
      </ListToolbar>

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
        <>
        <MobileSort table={table} />
        <Card>
          <div className="relative w-full overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, index) => {
                      const canSort = header.column.getCanSort();
                      const isSorted = header.column.getIsSorted();
                      return (
                        <TableHead
                          key={header.id}
                          className={index === 0 ? "col-frozen col-frozen-divider !z-30 !bg-muted min-w-[160px]" : undefined}
                        >
                          {header.isPlaceholder ? null : (
                            <div
                              className={canSort ? "flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground" : undefined}
                              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {canSort && (
                                <span className="text-muted-foreground">
                                  {isSorted === "asc" ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : isSorted === "desc" ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/customers/${row.original.slug}`)}
                  >
                    <TableCell className="col-frozen col-frozen-divider">
                      <div className="flex items-center gap-2">
                        {row.original.companyName ? (
                          <>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{row.original.companyName}</span>
                          </>
                        ) : (
                          <>
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{row.original.contactName}</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{row.original.contactName}</TableCell>
                    <TableCell>
                      {row.original.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {row.original.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.original.phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {row.original.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.original.street1 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="line-clamp-1">{formatAddress(row.original)}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, Number(data?.total ?? 0))} of {Number(data?.total ?? 0)} customers
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page * PAGE_SIZE >= Number(data?.total ?? 0)}>Next</Button>
            </div>
          </div>
        </Card>
        </>
      ) : (
        <EmptyState
          icon={search ? SearchX : Building2}
          heading={search ? "No customers match your search" : "No customers yet"}
          description={
            search
              ? "Try a different search term."
              : "Add your first customer to get started."
          }
          action={!search ? { label: "Add Customer", onClick: handleAdd } : undefined}
        />
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

              <PaymentTermsField form={form} />

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

              <PaymentTermsField form={form} />

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
