export const VENDOR_WORK_TYPES = [
  'Welding',
  'Civil Work',
  'Electrical',
  'Plumbing',
  'Painting',
  'Carpentry',
  'Roofing',
  'Flooring',
  'General Labour',
  'Transportation',
  'Masonry',
  'Steel Work',
] as const;

// Helper to check if a string is a predefined work type
export const isPredefinedWorkType = (value: string): boolean => {
  return (VENDOR_WORK_TYPES as readonly string[]).includes(value);
};

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
  'Chandigarh',
  'Andaman and Nicobar Islands',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep'
] as const;

export type VendorWorkType = typeof VENDOR_WORK_TYPES[number];
export type IndianState = typeof INDIAN_STATES[number];
