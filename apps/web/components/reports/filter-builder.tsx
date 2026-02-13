'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getAvailableFields,
  getFilterOperatorsByType,
  getOperatorLabel,
  type DataSource,
  type FilterOperator,
} from '@/lib/utils/chart-config';

export interface ReportFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  value?: string | number | boolean | string[];
  valueTo?: string; // For 'between' operator
}

interface FilterBuilderProps {
  dataSource: DataSource;
  filters: ReportFilter[];
  onFiltersChange: (filters: ReportFilter[]) => void;
}

export function FilterBuilder({ dataSource, filters, onFiltersChange }: FilterBuilderProps) {
  const availableFields = getAvailableFields(dataSource);

  const addFilter = () => {
    const newFilter: ReportFilter = {
      id: `filter-${Date.now()}`,
      field: '',
      operator: 'equals',
      dataType: 'string',
      value: '',
    };
    onFiltersChange([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<ReportFilter>) => {
    onFiltersChange(
      filters.map((f) => {
        if (f.id === id) {
          const updatedFilter = { ...f, ...updates };

          // Reset operator and dataType if field changed
          if (updates.field && updates.field !== f.field) {
            const fieldDef = availableFields.find((field) => field.id === updates.field);
            if (fieldDef) {
              updatedFilter.dataType = fieldDef.dataType;
              const operators = getFilterOperatorsByType(fieldDef.dataType);
              if (!operators.includes(updatedFilter.operator)) {
                updatedFilter.operator = operators[0];
              }
            }
          }

          return updatedFilter;
        }
        return f;
      })
    );
  };

  const getFieldDataType = (fieldId: string) => {
    return availableFields.find((f) => f.id === fieldId)?.dataType || 'string';
  };

  return (
    <div className="space-y-4">
      {filters.length > 0 && (
        <div className="space-y-3">
          {filters.map((filter) => {
            const fieldDataType = getFieldDataType(filter.field);
            const availableOperators = filter.field
              ? getFilterOperatorsByType(fieldDataType)
              : [];

            return (
              <div
                key={filter.id}
                className="flex items-end gap-2 rounded-md border p-4 bg-background"
              >
                <div className="flex-1 space-y-2">
                  <Label>Field</Label>
                  <Select
                    value={filter.field}
                    onValueChange={(value) => updateFilter(filter.id, { field: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 space-y-2">
                  <Label>Operator</Label>
                  <Select
                    value={filter.operator}
                    onValueChange={(value) =>
                      updateFilter(filter.id, { operator: value as FilterOperator })
                    }
                    disabled={!filter.field}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOperators.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {getOperatorLabel(operator)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 space-y-2">
                  <Label>Value</Label>
                  {filter.operator === 'between' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type={fieldDataType === 'date' ? 'date' : fieldDataType === 'number' ? 'number' : 'text'}
                        value={typeof filter.value === 'string' ? filter.value : ''}
                        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                        placeholder="From"
                      />
                      <span className="text-sm text-muted-foreground">to</span>
                      <Input
                        type={fieldDataType === 'date' ? 'date' : fieldDataType === 'number' ? 'number' : 'text'}
                        value={filter.valueTo || ''}
                        onChange={(e) => updateFilter(filter.id, { valueTo: e.target.value })}
                        placeholder="To"
                      />
                    </div>
                  ) : filter.operator === 'in' ? (
                    <Input
                      type="text"
                      value={
                        Array.isArray(filter.value)
                          ? filter.value.join(', ')
                          : filter.value !== undefined
                            ? String(filter.value)
                            : ''
                      }
                      onChange={(e) => {
                        const values = e.target.value
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean);
                        updateFilter(filter.id, { value: values });
                      }}
                      placeholder="Value 1, Value 2, ..."
                    />
                  ) : (
                    <Input
                      type={fieldDataType === 'date' ? 'date' : fieldDataType === 'number' ? 'number' : 'text'}
                      value={
                        typeof filter.value === 'string' || typeof filter.value === 'number'
                          ? String(filter.value)
                          : ''
                      }
                      onChange={(e) => {
                        const val =
                          fieldDataType === 'number'
                            ? parseFloat(e.target.value)
                            : fieldDataType === 'boolean'
                              ? e.target.value === 'true'
                              : e.target.value;
                        updateFilter(filter.id, { value: val });
                      }}
                      placeholder="Enter value"
                    />
                  )}
                </div>

                <Button variant="ghost" size="icon" onClick={() => removeFilter(filter.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {filters.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No filters added. Click "Add Filter" to filter your report data.
        </div>
      )}

      <Button type="button" variant="outline" onClick={addFilter}>
        <Plus className="mr-2 h-4 w-4" />
        Add Filter
      </Button>
    </div>
  );
}
