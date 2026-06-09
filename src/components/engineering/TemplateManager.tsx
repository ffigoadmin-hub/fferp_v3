import { useState } from 'react';
import { Plus, Trash2, FileText, Package, Edit, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useBOQTemplates, BOQTemplate, BOQTemplateItem } from '@/hooks/useBOQTemplates';
import { BOQ_CATEGORIES } from '@/constants/projectCategories';
import { toast } from 'sonner';

interface TemplateManagerProps {
  onLoadTemplate?: (items: Omit<BOQTemplateItem, 'id' | 'template_id' | 'created_at' | 'updated_at'>[]) => void;
}

export function TemplateManager({ onLoadTemplate }: TemplateManagerProps) {
  const { templates, isLoading, isSaving, createTemplate, updateTemplate, deleteTemplate, addItem, updateItem, deleteItem } = useBOQTemplates();
  
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCode, setNewTemplateCode] = useState('');
  const [editingTemplateName, setEditingTemplateName] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editedItem, setEditedItem] = useState<Partial<BOQTemplateItem>>({});
  
  const [newItem, setNewItem] = useState<Partial<BOQTemplateItem>>({
    material_name: '',
    specification: '',
    unit: 'units',
    category: 'material',
    default_quantity: 1,
    default_unit_cost: 0,
    phase_name: '',
  });

  const handleCreateTemplate = async () => {
    if (!newTemplateName || !newTemplateCode) {
      toast.error('Template name and code are required');
      return;
    }

    const result = await createTemplate(newTemplateCode, newTemplateName);
    if (result) {
      setNewTemplateName('');
      setNewTemplateCode('');
    }
  };

  const handleEditTemplateName = (templateId: string, currentName: string) => {
    setEditingTemplateName(templateId);
    setEditedName(currentName);
  };

  const handleSaveTemplateName = async (templateId: string) => {
    if (!editedName.trim()) {
      toast.error('Template name is required');
      return;
    }

    const success = await updateTemplate(templateId, { vertical_name: editedName.trim() });
    if (success) {
      setEditingTemplateName(null);
      setEditedName('');
    }
  };

  const handleCancelEditName = () => {
    setEditingTemplateName(null);
    setEditedName('');
  };

  const handleEditItem = (item: BOQTemplateItem) => {
    setEditingItemId(item.id);
    setEditedItem({ ...item });
  };

  const handleSaveEditedItem = async () => {
    if (!editingItemId || !editedItem.material_name) {
      toast.error('Material name is required');
      return;
    }

    const success = await updateItem(editingItemId, {
      material_name: editedItem.material_name,
      specification: editedItem.specification || null,
      unit: editedItem.unit || 'units',
      category: editedItem.category || 'material',
      default_quantity: editedItem.default_quantity || 1,
      default_unit_cost: editedItem.default_unit_cost || 0,
      phase_name: editedItem.phase_name || null,
    });

    if (success) {
      setEditingItemId(null);
      setEditedItem({});
    }
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    setEditedItem({});
  };

  const handleAddItemToTemplate = async (templateId: string, itemCount: number) => {
    if (!newItem.material_name) {
      toast.error('Material name is required');
      return;
    }

    const success = await addItem(templateId, {
      material_name: newItem.material_name,
      specification: newItem.specification || null,
      unit: newItem.unit || 'units',
      category: (newItem.category as 'material' | 'labour' | 'equipment') || 'material',
      default_quantity: newItem.default_quantity || 1,
      default_unit_cost: newItem.default_unit_cost || 0,
      sort_order: itemCount + 1,
      phase_name: newItem.phase_name || null,
    });

    if (success) {
      setNewItem({
        material_name: '',
        specification: '',
        unit: 'units',
        category: 'material',
        default_quantity: 1,
        default_unit_cost: 0,
        phase_name: '',
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template and all its items?')) return;
    await deleteTemplate(templateId);
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteItem(itemId);
  };

  const handleUseTemplate = (template: BOQTemplate) => {
    if (onLoadTemplate && template.items.length > 0) {
      const items = template.items.map(item => ({
        material_name: item.material_name,
        specification: item.specification,
        unit: item.unit,
        category: item.category,
        default_quantity: item.default_quantity,
        default_unit_cost: item.default_unit_cost,
        sort_order: item.sort_order,
        phase_name: item.phase_name,
      }));
      onLoadTemplate(items);
      toast.success(`Loaded ${template.items.length} items from ${template.vertical_name} template`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create New Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Create New Template
          </CardTitle>
          <CardDescription>
            Create custom BOQ templates for different project types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Solar Farm"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Template Code *</Label>
              <Input
                value={newTemplateCode}
                onChange={(e) => setNewTemplateCode(e.target.value)}
                placeholder="e.g., solar_farm"
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateTemplate} className="w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Available Templates ({templates.length})
          </CardTitle>
          <CardDescription>
            View and manage BOQ templates. All templates can be edited and customized.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {templates.map((template) => {
              const isEditingName = editingTemplateName === template.id;

              return (
                <AccordionItem key={template.id} value={template.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {isEditingName ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="h-7 w-40"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={isSaving}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveTemplateName(template.id);
                            }}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEditName();
                            }}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium">{template.vertical_name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTemplateName(template.id, template.vertical_name);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      <Badge variant={template.is_system ? 'secondary' : 'default'}>
                        {template.is_system ? 'System' : 'Custom'}
                      </Badge>
                      <Badge variant="outline">{template.items.length} items</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {/* Template Items Table */}
                      {template.items.length > 0 ? (
                        <div className="overflow-x-auto border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Phase</TableHead>
                                <TableHead>Material</TableHead>
                                <TableHead>Specification</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Default Qty</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead>Est. Cost</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {template.items.map((item) => {
                                const isEditingThisItem = editingItemId === item.id;

                                if (isEditingThisItem) {
                                  return (
                                    <TableRow key={item.id} className="bg-muted/30">
                                      <TableCell>
                                        <Input
                                          value={editedItem.phase_name || ''}
                                          onChange={(e) => setEditedItem({ ...editedItem, phase_name: e.target.value })}
                                          className="h-8 w-28"
                                          placeholder="Phase name"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          value={editedItem.material_name || ''}
                                          onChange={(e) => setEditedItem({ ...editedItem, material_name: e.target.value })}
                                          className="h-8"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          value={editedItem.specification || ''}
                                          onChange={(e) => setEditedItem({ ...editedItem, specification: e.target.value })}
                                          className="h-8"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={editedItem.category}
                                          onValueChange={(v) => setEditedItem({ ...editedItem, category: v as any })}
                                        >
                                          <SelectTrigger className="h-8">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {BOQ_CATEGORIES.map((c) => (
                                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          value={editedItem.default_quantity || 0}
                                          onChange={(e) => setEditedItem({ ...editedItem, default_quantity: parseFloat(e.target.value) || 0 })}
                                          className="h-8 w-20"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          value={editedItem.unit || ''}
                                          onChange={(e) => setEditedItem({ ...editedItem, unit: e.target.value })}
                                          className="h-8 w-20"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          value={editedItem.default_unit_cost || 0}
                                          onChange={(e) => setEditedItem({ ...editedItem, default_unit_cost: parseFloat(e.target.value) || 0 })}
                                          className="h-8 w-24"
                                        />
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            disabled={isSaving}
                                            onClick={handleSaveEditedItem}
                                          >
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={handleCancelEditItem}
                                          >
                                            <X className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                return (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <Badge variant={item.phase_name ? 'secondary' : 'outline'} className="text-xs">
                                        {item.phase_name || 'No Phase'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{item.material_name}</TableCell>
                                    <TableCell className="text-muted-foreground">{item.specification || '-'}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="capitalize">{item.category}</Badge>
                                    </TableCell>
                                    <TableCell>{item.default_quantity || 1}</TableCell>
                                    <TableCell>{item.unit}</TableCell>
                                    <TableCell>₹{item.default_unit_cost?.toLocaleString() || 0}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => handleEditItem(item)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          disabled={isSaving}
                                          onClick={() => handleDeleteItem(item.id)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No items in this template</p>
                      )}

                      {/* Add Item Form */}
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <p className="font-medium mb-3">Add Item to Template</p>
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                          <div>
                            <Label className="text-xs">Phase</Label>
                            <Input
                              value={newItem.phase_name || ''}
                              onChange={(e) => setNewItem({ ...newItem, phase_name: e.target.value })}
                              placeholder="e.g., Foundation"
                              className="mt-1"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-xs">Material Name *</Label>
                            <Input
                              value={newItem.material_name}
                              onChange={(e) => setNewItem({ ...newItem, material_name: e.target.value })}
                              placeholder="e.g., Solar Panel"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Category</Label>
                            <Select
                              value={newItem.category}
                              onValueChange={(v) => setNewItem({ ...newItem, category: v as any })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {BOQ_CATEGORIES.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Default Qty</Label>
                            <Input
                              type="number"
                              value={newItem.default_quantity}
                              onChange={(e) => setNewItem({ ...newItem, default_quantity: parseFloat(e.target.value) || 0 })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit</Label>
                            <Input
                              value={newItem.unit}
                              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Est. Cost</Label>
                            <Input
                              type="number"
                              value={newItem.default_unit_cost}
                              onChange={(e) => setNewItem({ ...newItem, default_unit_cost: parseFloat(e.target.value) || 0 })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <Label className="text-xs">Specification</Label>
                          <Input
                            value={newItem.specification || ''}
                            onChange={(e) => setNewItem({ ...newItem, specification: e.target.value })}
                            placeholder="e.g., 400W monocrystalline"
                            className="mt-1"
                          />
                        </div>
                        <Button
                          onClick={() => handleAddItemToTemplate(template.id, template.items.length)}
                          className="mt-3"
                          size="sm"
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                          Add Item
                        </Button>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        {onLoadTemplate && template.items.length > 0 && (
                          <Button variant="outline" onClick={() => handleUseTemplate(template)}>
                            <Package className="h-4 w-4 mr-2" /> Use This Template
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete Template
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {templates.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No templates available. Create one above!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
