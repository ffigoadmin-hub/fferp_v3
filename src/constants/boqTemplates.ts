// BOQ Templates by Project Vertical
// These are standard materials used for each project type
// Only quantity varies between projects

export interface BOQTemplateItem {
  material_name: string;
  specification: string;
  unit: string;
  category: 'material' | 'labour' | 'equipment';
  default_quantity?: number;
  default_unit_cost?: number;
}

export interface BOQTemplate {
  vertical_code: string;
  vertical_name: string;
  items: BOQTemplateItem[];
}

export const BOQ_TEMPLATES: BOQTemplate[] = [
  {
    vertical_code: 'mushroom',
    vertical_name: 'Mushroom',
    items: [
      { material_name: 'Spawn Bottles', specification: 'High-quality mushroom spawn', unit: 'bottles', category: 'material', default_quantity: 100 },
      { material_name: 'Substrate Bags', specification: 'Sterilized substrate for growing', unit: 'bags', category: 'material', default_quantity: 200 },
      { material_name: 'Humidity Control System', specification: 'Automatic misting system', unit: 'set', category: 'equipment', default_quantity: 1 },
      { material_name: 'Exhaust Fans', specification: '12 inch industrial fans', unit: 'units', category: 'equipment', default_quantity: 4 },
      { material_name: 'Thermometer Hygrometer', specification: 'Digital with display', unit: 'units', category: 'equipment', default_quantity: 2 },
      { material_name: 'Shade Net', specification: '80% shade, UV stabilized', unit: 'sqm', category: 'material', default_quantity: 100 },
      { material_name: 'Racking System', specification: 'Metal racks for bags', unit: 'set', category: 'equipment', default_quantity: 10 },
      { material_name: 'Plastic Sheets', specification: 'Black plastic for flooring', unit: 'sqm', category: 'material', default_quantity: 50 },
      { material_name: 'Sprayer', specification: 'Manual pressure sprayer', unit: 'units', category: 'equipment', default_quantity: 2 },
      { material_name: 'Labour - Setup', specification: 'Installation and setup work', unit: 'days', category: 'labour', default_quantity: 10 },
    ],
  },
  {
    vertical_code: 'polyhouse',
    vertical_name: 'Polyhouse',
    items: [
      { material_name: 'GI Pipes', specification: '40mm diameter, hot-dip galvanized', unit: 'meters', category: 'material', default_quantity: 500 },
      { material_name: 'Poly Film', specification: '200 micron UV stabilized', unit: 'sqm', category: 'material', default_quantity: 1000 },
      { material_name: 'Shade Net', specification: '50% shade, green color', unit: 'sqm', category: 'material', default_quantity: 500 },
      { material_name: 'Fogger System', specification: 'Complete fogging system with pump', unit: 'set', category: 'equipment', default_quantity: 1 },
      { material_name: 'Drip Irrigation Kit', specification: 'Complete kit with laterals', unit: 'set', category: 'equipment', default_quantity: 1 },
      { material_name: 'Exhaust Fans', specification: '48 inch industrial exhaust fans', unit: 'units', category: 'equipment', default_quantity: 4 },
      { material_name: 'Cooling Pads', specification: 'Cellulose cooling pads', unit: 'sqm', category: 'material', default_quantity: 20 },
      { material_name: 'Foundation Cement', specification: '53 grade OPC cement', unit: 'bags', category: 'material', default_quantity: 100 },
      { material_name: 'Sand', specification: 'River sand, clean', unit: 'cubic meters', category: 'material', default_quantity: 10 },
      { material_name: 'Gutter Channel', specification: 'GI gutter for rainwater', unit: 'meters', category: 'material', default_quantity: 100 },
      { material_name: 'Labour - Construction', specification: 'Polyhouse construction work', unit: 'days', category: 'labour', default_quantity: 30 },
      { material_name: 'Labour - Plumbing', specification: 'Irrigation setup work', unit: 'days', category: 'labour', default_quantity: 10 },
    ],
  },
  {
    vertical_code: 'microgreens',
    vertical_name: 'Microgreens',
    items: [
      { material_name: 'Growing Trays', specification: '10x20 inch standard trays', unit: 'units', category: 'material', default_quantity: 100 },
      { material_name: 'Growing Medium', specification: 'Coco peat or soil mix', unit: 'kg', category: 'material', default_quantity: 200 },
      { material_name: 'Seeds Assorted', specification: 'Microgreen seed varieties', unit: 'kg', category: 'material', default_quantity: 20 },
      { material_name: 'LED Grow Lights', specification: 'Full spectrum LED panels', unit: 'units', category: 'equipment', default_quantity: 20 },
      { material_name: 'Shelving Units', specification: 'Metal shelving for trays', unit: 'units', category: 'equipment', default_quantity: 10 },
      { material_name: 'Spray Bottles', specification: 'Fine mist sprayers', unit: 'units', category: 'equipment', default_quantity: 10 },
      { material_name: 'Timer Switches', specification: 'Digital programmable timers', unit: 'units', category: 'equipment', default_quantity: 5 },
      { material_name: 'Packaging Materials', specification: 'Clamshell containers', unit: 'units', category: 'material', default_quantity: 500 },
      { material_name: 'Labour - Setup', specification: 'Initial setup and training', unit: 'days', category: 'labour', default_quantity: 5 },
    ],
  },
  {
    vertical_code: 'goat_farming',
    vertical_name: 'Goat Farming',
    items: [
      { material_name: 'Chain Link Fencing', specification: '4 ft height, GI coated', unit: 'meters', category: 'material', default_quantity: 200 },
      { material_name: 'GI Poles', specification: '2.5 inch diameter', unit: 'units', category: 'material', default_quantity: 50 },
      { material_name: 'Roofing Sheets', specification: 'Color coated GI sheets', unit: 'sqm', category: 'material', default_quantity: 100 },
      { material_name: 'Water Troughs', specification: 'Plastic water containers', unit: 'units', category: 'equipment', default_quantity: 10 },
      { material_name: 'Feed Troughs', specification: 'Metal feeding containers', unit: 'units', category: 'equipment', default_quantity: 10 },
      { material_name: 'Cement', specification: '53 grade OPC', unit: 'bags', category: 'material', default_quantity: 50 },
      { material_name: 'Bricks', specification: 'Red clay bricks', unit: 'units', category: 'material', default_quantity: 5000 },
      { material_name: 'Labour - Construction', specification: 'Shed construction work', unit: 'days', category: 'labour', default_quantity: 20 },
    ],
  },
  {
    vertical_code: 'crab_farming',
    vertical_name: 'Crab Farming',
    items: [
      { material_name: 'HDPE Liner', specification: '500 micron pond liner', unit: 'sqm', category: 'material', default_quantity: 500 },
      { material_name: 'Crab Boxes', specification: 'Individual crab grow-out boxes', unit: 'units', category: 'equipment', default_quantity: 1000 },
      { material_name: 'Aerator System', specification: 'Paddle wheel aerators', unit: 'set', category: 'equipment', default_quantity: 2 },
      { material_name: 'Water Pump', specification: '5 HP submersible pump', unit: 'units', category: 'equipment', default_quantity: 2 },
      { material_name: 'PVC Pipes', specification: '4 inch diameter for water flow', unit: 'meters', category: 'material', default_quantity: 100 },
      { material_name: 'Nets', specification: 'Protection nets for ponds', unit: 'sqm', category: 'material', default_quantity: 200 },
      { material_name: 'Water Quality Kit', specification: 'Testing kit for water parameters', unit: 'set', category: 'equipment', default_quantity: 2 },
      { material_name: 'Labour - Pond Construction', specification: 'Pond digging and setup', unit: 'days', category: 'labour', default_quantity: 30 },
    ],
  },
  {
    vertical_code: 'open_cultivation',
    vertical_name: 'Open Cultivation',
    items: [
      { material_name: 'Drip Irrigation System', specification: 'Complete drip kit', unit: 'set', category: 'equipment', default_quantity: 1 },
      { material_name: 'Mulching Film', specification: 'Black plastic mulch', unit: 'sqm', category: 'material', default_quantity: 1000 },
      { material_name: 'Fertilizers', specification: 'NPK and organic fertilizers', unit: 'kg', category: 'material', default_quantity: 500 },
      { material_name: 'Pesticides', specification: 'Organic pest control', unit: 'liters', category: 'material', default_quantity: 50 },
      { material_name: 'Seeds/Seedlings', specification: 'As per crop selection', unit: 'units', category: 'material', default_quantity: 5000 },
      { material_name: 'Labour - Land Preparation', specification: 'Tilling and bed preparation', unit: 'days', category: 'labour', default_quantity: 10 },
      { material_name: 'Labour - Planting', specification: 'Transplanting work', unit: 'days', category: 'labour', default_quantity: 5 },
    ],
  },
];

export function getTemplateByVerticalCode(code: string): BOQTemplate | undefined {
  // Match case-insensitively and handle both code and name
  const normalizedCode = code?.toLowerCase().replace(/[^a-z]/g, '') || '';
  return BOQ_TEMPLATES.find(t => 
    t.vertical_code === normalizedCode || 
    t.vertical_name.toLowerCase().replace(/[^a-z]/g, '') === normalizedCode
  );
}
