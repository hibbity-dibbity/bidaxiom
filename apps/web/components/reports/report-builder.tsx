'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterBuilder, type ReportFilter } from './filter-builder';
import { ChartPreview } from './chart-preview';
import { trpc } from '@/lib/trpc';
import {
  getAvailableFields,
  getChartTypeOptions,
  getAggregationOptions,
  type DataSource,
  type ChartType,
  type AggregationType,
} from '@/lib/utils/chart-config';

const reportConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  dataSource: z.enum(['projects', 'budgets', 'change_orders', 'bids', 'commitments']),
  columns: z.array(
    z.object({
      field: z.string(),
      label: z.string(),
      aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count']).optional(),
    })
  ),
  filters: z.array(z.any()),
  chartConfig: z
    .object({
      chartType: z.enum(['bar', 'line', 'pie', 'area', 'table', 'doughnut']),
      xAxis: z.string().min(1),
      yAxis: z.string().min(1),
    })
    .optional(),
});

type ReportConfig = z.infer<typeof reportConfigSchema>;

interface SortableColumnItemProps {
  column: ReportConfig['columns'][0];
  index: number;
  onRemove: () => void;
  onAggregationChange: (aggregation?: AggregationType) => void;
  isAggregatable: boolean;
}

function SortableColumnItem({
  column,
  index,
  onRemove,
  onAggregationChange,
  isAggregatable,
}: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `${column.field}-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border p-3 bg-background"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{column.label}</p>
      </div>
      {isAggregatable && (
        <Select
          value={column.aggregation || 'none'}
          onValueChange={(value) => onAggregationChange(value === 'none' ? undefined : (value as AggregationType))}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Aggregation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {getAggregationOptions().map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ReportBuilderProps {
  onSuccess?: (reportId: string) => void;
}

export function ReportBuilder({ onSuccess }: ReportBuilderProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedColumns, setSelectedColumns] = useState<ReportConfig['columns']>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);

  const form = useForm<ReportConfig>({
    resolver: zodResolver(reportConfigSchema),
    defaultValues: {
      name: '',
      description: '',
      dataSource: 'projects',
      columns: [],
      filters: [],
      chartConfig: {
        chartType: 'table',
      },
    },
  });

  const dataSource = form.watch('dataSource');
  const chartConfig = form.watch('chartConfig');
  const availableFields = getAvailableFields(dataSource);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createMutation = trpc.report.create.useMutation({
    onSuccess: (data: any) => {
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        router.push(`/reports/${data.id}`);
      }
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSelectedColumns((items) => {
        const oldIndex = items.findIndex((item, idx) => `${item.field}-${idx}` === active.id);
        const newIndex = items.findIndex((item, idx) => `${item.field}-${idx}` === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addColumn = (fieldId: string) => {
    const field = availableFields.find((f) => f.id === fieldId);
    if (!field) return;

    const alreadyAdded = selectedColumns.some((col) => col.field === fieldId);
    if (alreadyAdded) return;

    setSelectedColumns([
      ...selectedColumns,
      {
        field: field.id,
        label: field.label,
        aggregation: undefined,
      },
    ]);
  };

  const removeColumn = (field: string) => {
    setSelectedColumns(selectedColumns.filter((col) => col.field !== field));
  };

  const updateColumnAggregation = (field: string, aggregation?: AggregationType) => {
    setSelectedColumns(
      selectedColumns.map((col) =>
        col.field === field ? { ...col, aggregation } : col
      )
    );
  };

  const handleNext = () => {
    if (currentStep === 2) {
      // Update form with selected columns before moving to next step
      form.setValue('columns', selectedColumns);
    }
    if (currentStep === 3) {
      // Update form with filters before moving to next step
      form.setValue('filters', filters);
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const onSubmit = (data: ReportConfig) => {
    // Transform filters to match schema (remove UI-only fields)
    const transformedFilters = filters.map(({ field, operator, dataType, value }) => ({
      field,
      operator,
      dataType,
      value,
    }));

    createMutation.mutate({
      name: data.name,
      description: data.description,
      type: 'custom',
      dataSource: data.dataSource,
      columns: selectedColumns,
      filters: transformedFilters,
      chartConfig: data.chartConfig,
    } as any);
  };

  return (
    <div className="space-y-6">
      {/* Step Progress Indicator */}
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                currentStep >= step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted bg-background text-muted-foreground'
              }`}
            >
              {step}
            </div>
            {step < 4 && (
              <div
                className={`h-0.5 w-16 ${
                  currentStep > step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Basics */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Report Basics</h2>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Project Status Summary" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of what this report shows"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dataSource"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Data Source</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 gap-4"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="projects" />
                          </FormControl>
                          <FormLabel className="font-normal">Projects</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="budgets" />
                          </FormControl>
                          <FormLabel className="font-normal">Budgets</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="change_orders" />
                          </FormControl>
                          <FormLabel className="font-normal">Change Orders</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="bids" />
                          </FormControl>
                          <FormLabel className="font-normal">Bids</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="commitments" />
                          </FormControl>
                          <FormLabel className="font-normal">Commitments</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Step 2: Columns */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Select Columns</h2>
              <p className="text-sm text-muted-foreground">
                Choose which fields to include in your report. Drag to reorder.
              </p>

              <div className="space-y-2">
                <FormLabel>Add Column</FormLabel>
                <Select onValueChange={addColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a field to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields
                      .filter(
                        (field) => !selectedColumns.some((col) => col.field === field.id)
                      )
                      .map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedColumns.length > 0 && (
                <div className="space-y-2">
                  <FormLabel>Selected Columns</FormLabel>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={selectedColumns.map((col, idx) => `${col.field}-${idx}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {selectedColumns.map((column, index) => {
                          const field = availableFields.find((f) => f.id === column.field);
                          return (
                            <SortableColumnItem
                              key={column.field}
                              column={column}
                              index={index}
                              onRemove={() => removeColumn(column.field)}
                              onAggregationChange={(agg) =>
                                updateColumnAggregation(column.field, agg)
                              }
                              isAggregatable={field?.aggregatable || false}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              {selectedColumns.length === 0 && (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No columns selected. Add fields to include in your report.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Filters */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Add Filters</h2>
              <p className="text-sm text-muted-foreground">
                Filter the data shown in your report.
              </p>
              <FilterBuilder
                dataSource={dataSource}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>
          )}

          {/* Step 4: Charts */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Chart Configuration (Optional)</h2>
              <FormField
                control={form.control}
                name="chartConfig.chartType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chart Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select chart type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getChartTypeOptions().map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {chartConfig?.chartType && chartConfig.chartType !== 'table' && (
                <>
                  <FormField
                    control={form.control}
                    name="chartConfig.xAxis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>X-Axis Field</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select X-axis field" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedColumns.map((col) => (
                              <SelectItem key={col.field} value={col.field}>
                                {col.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="chartConfig.yAxis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Y-Axis Field</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Y-axis field" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedColumns
                              .filter((col) => {
                                const fieldDef = availableFields.find(
                                  (f) => f.id === col.field
                                );
                                return fieldDef?.dataType === 'number';
                              })
                              .map((col) => (
                                <SelectItem key={col.field} value={col.field}>
                                  {col.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {chartConfig.xAxis && chartConfig.yAxis && (
                    <div>
                      <FormLabel>Preview</FormLabel>
                      <ChartPreview
                        chartConfig={chartConfig as any}
                        data={[
                          { [chartConfig.xAxis]: 'Sample 1', [chartConfig.yAxis]: 100 },
                          { [chartConfig.xAxis]: 'Sample 2', [chartConfig.yAxis]: 200 },
                          { [chartConfig.xAxis]: 'Sample 3', [chartConfig.yAxis]: 150 },
                        ]}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              Back
            </Button>
            <div className="flex gap-2">
              {currentStep < 4 && (
                <Button type="button" onClick={handleNext}>
                  Next
                </Button>
              )}
              {currentStep === 4 && (
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Report'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
