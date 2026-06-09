export interface Profile {
  id: string;
  name: string;
  department: string;
  lop: number;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeMasterRow {
  id?: string;
  profile_id: string;
  designation?: string;
  doj?: string; // date of joining
  salary?: number;
  bank?: string;
  pf?: string; // provident fund
  esi?: string; // employee state insurance
  status?: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeMasterWithProfile extends EmployeeMasterRow {
  profile: Profile;
}

export interface EmployeeMasterFormData {
  profile_id: string;
  designation?: string;
  doj?: string;
  salary?: number;
  bank?: string;
  pf?: string;
  esi?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface EmployeeFilters {
  search?: string;
  department?: string;
}
