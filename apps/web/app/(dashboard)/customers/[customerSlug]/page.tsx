"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Building2, User, Mail, Phone, MapPin, Briefcase } from "lucide-react";
import type { ProjectStatus } from "@construction/shared";

const statusColors: Record<ProjectStatus, string> = {
  active: "bg-green-500/10 text-green-700 border-green-200",
  on_hold: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  completed: "bg-blue-500/10 text-blue-700 border-blue-200",
  archived: "bg-gray-500/10 text-gray-700 border-gray-200",
};

export default function CustomerDetailPage({
  params,
}: {
  params: { customerSlug: string };
}) {
  const { customerSlug } = params;
  const { data: customer, isLoading } = trpc.customer.getBySlug.useQuery({ slug: customerSlug });

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
            <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
          </div>
          {customer.companyName && (
            <p className="text-muted-foreground">Contact: {customer.contactName}</p>
          )}
        </div>
        <Button variant="outline" asChild>
          <Link href="/customers">Back to Customers</Link>
        </Button>
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
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2">
                          {project.jobNumber && (
                            <>{project.jobNumber}-</>
                          )}
                          {project.name}
                        </CardTitle>
                        <Badge className={statusColors[project.status as ProjectStatus]} variant="outline">
                          {project.status.replace("_", " ")}
                        </Badge>
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
    </div>
  );
}
