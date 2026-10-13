"use client";

import * as React from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  canManage: boolean;
}

/** Company contact info printed in the top right of every proposal. Saves on its own. */
export function CompanyContactCard({ canManage }: Props) {
  const utils = trpc.useUtils();
  const { data } = trpc.company.getCurrent.useQuery();
  const [values, setValues] = React.useState({
    phone: "",
    website: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
  });
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!data || loaded) return;
    setValues({
      phone: data.phone ?? "",
      website: data.website ?? "",
      street1: data.street1 ?? "",
      street2: data.street2 ?? "",
      city: data.city ?? "",
      state: data.state ?? "",
      zip: data.zip ?? "",
    });
    setLoaded(true);
  }, [data, loaded]);

  const save = trpc.company.updateContact.useMutation({
    onSuccess: () => {
      utils.company.getCurrent.invalidate();
      toast.success("Company contact info saved");
    },
    onError: (e) => toast.error(e.message || "Could not save contact info"),
  });

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Contact info on proposals</h2>
        <p className="text-sm text-muted-foreground">
          Printed under your company name at the top right of the customer view and PDF.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="company-phone">Phone</Label>
          <Input id="company-phone" className="mt-2" value={values.phone} onChange={set("phone")} disabled={!canManage} placeholder="713-555-0100" />
        </div>
        <div>
          <Label htmlFor="company-website">Website</Label>
          <Input id="company-website" className="mt-2" value={values.website} onChange={set("website")} disabled={!canManage} placeholder="example.com" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="company-street1">Street address</Label>
          <Input id="company-street1" className="mt-2" value={values.street1} onChange={set("street1")} disabled={!canManage} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="company-street2">Suite or unit</Label>
          <Input id="company-street2" className="mt-2" value={values.street2} onChange={set("street2")} disabled={!canManage} />
        </div>
        <div>
          <Label htmlFor="company-city">City</Label>
          <Input id="company-city" className="mt-2" value={values.city} onChange={set("city")} disabled={!canManage} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="company-state">State</Label>
            <Input id="company-state" className="mt-2" maxLength={2} value={values.state} onChange={set("state")} disabled={!canManage} placeholder="TX" />
          </div>
          <div>
            <Label htmlFor="company-zip">ZIP</Label>
            <Input id="company-zip" className="mt-2" value={values.zip} onChange={set("zip")} disabled={!canManage} />
          </div>
        </div>
      </div>
      {canManage && (
        <div className="mt-4 flex justify-end">
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate({
            phone: values.phone,
            website: values.website,
            street1: values.street1,
            street2: values.street2,
            city: values.city,
            state: values.state,
            zip: values.zip,
          })}>
            {save.isPending ? "Saving..." : "Save contact info"}
          </Button>
        </div>
      )}
    </Card>
  );
}
