import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Building2,
  Loader2,
  Power,
  PowerOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  usePaymentTags,
  PaymentTag,
  CreateTagData,
  TAG_COLORS,
  AVAILABLE_COLORS,
} from '@/hooks/usePaymentTags';
import { cn } from '@/lib/utils';
import { DEPARTMENTS } from '@/constants/departments';

const DEPARTMENT_OPTIONS = DEPARTMENTS.map((dept) => ({
  label: dept.label,
  value: dept.value,
}));

export default function PaymentTagsPage() {
  const { tags, isLoading, isSaving, createTag, updateTag, deleteTag, toggleActive, fetchTags } = usePaymentTags({ includeInactive: true });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<PaymentTag | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<PaymentTag | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [formDepartments, setFormDepartments] = useState<string[]>([]);
  const [formOrder, setFormOrder] = useState(0);

  const resetForm = () => {
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormColor('blue');
    setFormDepartments([]);
    setFormOrder(0);
    setEditingTag(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setFormOrder(tags.length + 1);
    setDialogOpen(true);
  };

  const openEditDialog = (tag: PaymentTag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormCode(tag.code);
    setFormDescription(tag.description || '');
    setFormColor(tag.color);
    setFormDepartments(tag.departments);
    setFormOrder(tag.display_order);
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    // Auto-generate code from name if not editing
    if (!editingTag) {
      const code = name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      setFormCode(code);
    }
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !formCode.trim()) return;

    if (editingTag) {
      await updateTag(editingTag.id, {
        name: formName,
        code: formCode,
        description: formDescription || undefined,
        color: formColor,
        departments: formDepartments,
        display_order: formOrder,
      });
    } else {
      await createTag({
        name: formName,
        code: formCode,
        description: formDescription || undefined,
        color: formColor,
        departments: formDepartments,
        display_order: formOrder,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (tagToDelete) {
      await deleteTag(tagToDelete.id);
      setDeleteConfirmOpen(false);
      setTagToDelete(null);
    }
  };

  const activeTags = tags.filter(t => t.is_active);
  const inactiveTags = tags.filter(t => !t.is_active);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tags className="w-6 h-6 text-primary" />
            Payment Tags
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage payment categories and tags for better organization
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Tag
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Total Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tags.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-status-live">{activeTags.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-muted-foreground">{inactiveTags.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tags Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Tag Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No payment tags found. Click "Add Tag" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => {
                  const colorStyle = TAG_COLORS[tag.color] || TAG_COLORS.blue;
                  return (
                    <TableRow key={tag.id} className={cn(!tag.is_active && 'opacity-50')}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tag.display_order}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{tag.name}</div>
                        {tag.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {tag.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {tag.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            colorStyle.bg,
                            colorStyle.text,
                            colorStyle.border
                          )}
                        >
                          {tag.color}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tag.departments.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">All Departments</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {tag.departments.slice(0, 2).map(d => (
                              <Badge key={d} variant="secondary" className="text-[10px]">
                                {d}
                              </Badge>
                            ))}
                            {tag.departments.length > 2 && (
                              <Badge variant="secondary" className="text-[10px]">
                                +{tag.departments.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={tag.is_active}
                          onCheckedChange={(checked) => toggleActive(tag.id, checked)}
                          disabled={isSaving}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(tag)}
                            className="h-8 w-8"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTagToDelete(tag);
                              setDeleteConfirmOpen(true);
                            }}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? 'Edit Payment Tag' : 'Create Payment Tag'}
            </DialogTitle>
            <DialogDescription>
              {editingTag
                ? 'Update the tag details below'
                : 'Add a new category tag for payment requests'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tag Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Tag Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Local Purchase"
              />
            </div>

            {/* Tag Code */}
            <div className="space-y-2">
              <Label htmlFor="code">Tag Code *</Label>
              <Input
                id="code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g., local_purchase"
                disabled={!!editingTag}
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier (lowercase, underscores only)
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this tag..."
                rows={2}
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Badge Color</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_COLORS.map((color) => {
                  const colorStyle = TAG_COLORS[color];
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
                        colorStyle.bg,
                        formColor === color
                          ? 'ring-2 ring-offset-2 ring-primary scale-110'
                          : 'border-transparent hover:scale-105'
                      )}
                    >
                      {formColor === color && (
                        <Check className={cn('w-4 h-4', colorStyle.text)} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Department Selection - Searchable MultiSelect */}
            <div className="space-y-2">
              <Label>Available for Departments</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Leave empty to make this tag available to all departments
              </p>
              <MultiSelect
                options={DEPARTMENT_OPTIONS}
                selected={formDepartments}
                onChange={setFormDepartments}
                placeholder="Search and select departments..."
              />
            </div>

            {/* Display Order */}
            <div className="space-y-2">
              <Label htmlFor="order">Display Order</Label>
              <Input
                id="order"
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !formName.trim() || !formCode.trim()}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {editingTag ? 'Update Tag' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disable Tag?</DialogTitle>
            <DialogDescription>
              This will disable the tag "{tagToDelete?.name}". It will no longer appear in the payment form but existing tagged payments will retain this tag.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Disable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
