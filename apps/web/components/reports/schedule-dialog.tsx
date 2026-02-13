'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const scheduleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  recipients: z.array(z.string().email()).min(1, 'At least one recipient is required'),
  format: z.enum(['pdf', 'excel', 'csv']),
  isActive: z.boolean(),
});

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

interface ScheduleDialogProps {
  reportDefinitionId: string;
  existingSchedule?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleDialog({
  reportDefinitionId,
  existingSchedule,
  open,
  onOpenChange,
}: ScheduleDialogProps) {
  const [recipientInput, setRecipientInput] = useState('');
  const utils = trpc.useUtils();

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: existingSchedule
      ? {
          name: existingSchedule.name,
          frequency: existingSchedule.frequency,
          dayOfWeek: existingSchedule.dayOfWeek,
          dayOfMonth: existingSchedule.dayOfMonth,
          time: existingSchedule.time,
          recipients: existingSchedule.recipients,
          format: existingSchedule.format,
          isActive: existingSchedule.isActive,
        }
      : {
          name: '',
          frequency: 'weekly',
          time: '09:00',
          recipients: [],
          format: 'pdf',
          isActive: true,
        },
  });

  const frequency = form.watch('frequency');
  const recipients = form.watch('recipients');

  const createMutation = trpc.reportSchedule.create.useMutation({
    onSuccess: () => {
      toast.success('Report schedule created successfully');
      utils.reportSchedule.list.invalidate();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create schedule');
    },
  });

  const updateMutation = trpc.reportSchedule.update.useMutation({
    onSuccess: () => {
      toast.success('Report schedule updated successfully');
      utils.reportSchedule.list.invalidate();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update schedule');
    },
  });

  const addRecipient = () => {
    if (!recipientInput) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientInput)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (recipients.includes(recipientInput)) {
      toast.error('This email is already in the recipients list');
      return;
    }

    form.setValue('recipients', [...recipients, recipientInput]);
    setRecipientInput('');
  };

  const removeRecipient = (email: string) => {
    form.setValue(
      'recipients',
      recipients.filter((r) => r !== email)
    );
  };

  const onSubmit = (data: ScheduleFormValues) => {
    if (existingSchedule) {
      updateMutation.mutate({
        id: existingSchedule.id,
        data: {
          id: existingSchedule.id, // Schema expects id in data object too
          name: data.name,
          frequency: data.frequency,
          dayOfWeek: data.dayOfWeek,
          dayOfMonth: data.dayOfMonth,
          time: data.time,
          recipients: data.recipients,
          format: data.format,
          isActive: data.isActive,
        },
      } as any);
    } else {
      createMutation.mutate({
        reportDefinitionId,
        name: data.name,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        time: data.time,
        recipients: data.recipients,
        format: data.format,
        isActive: data.isActive,
        createdBy: '', // Will be set by API from ctx.userId
      } as any);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingSchedule ? 'Edit Schedule' : 'Schedule Report Delivery'}
          </DialogTitle>
          <DialogDescription>
            Configure automatic report delivery on a recurring schedule.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Weekly Project Status" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {frequency === 'weekly' && (
              <FormField
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Week</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {frequency === 'monthly' && (
              <FormField
                control={form.control}
                name="dayOfMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Month</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="1-31"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      If the day doesn't exist in a month (e.g., 31st in February), the last day
                      of the month will be used.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="recipients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipients</FormLabel>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={recipientInput}
                        onChange={(e) => setRecipientInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addRecipient();
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={addRecipient}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {recipients.length > 0 && (
                      <div className="space-y-2">
                        {recipients.map((email) => (
                          <div
                            key={email}
                            className="flex items-center justify-between rounded-md border p-2"
                          >
                            <span className="text-sm">{email}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRecipient(email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Export Format</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Inactive schedules will not run until re-enabled.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : existingSchedule
                    ? 'Update Schedule'
                    : 'Create Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
