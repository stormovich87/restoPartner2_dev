export interface Role {
  id: string;
  name: string;
  display_name: string;
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  url_suffix: string;
  logo_url: string | null;
  status: 'active' | 'paused' | 'deleted';
  pause_message: string | null;
  created_at: string;
}

export interface Branch {
  id: string;
  partner_id: string;
  name: string;
  address: string;
  phone: string;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  poster_enabled?: boolean | null;
  poster_spot_id?: number | null;
  poster_spot_name?: string | null;
  poster_spot_address?: string | null;
  created_at: string;
}

export interface User {
  id: string;
  login: string;
  password_hash: string;
  role_id: string;
  partner_id: string | null;
  branch_id: string | null;
  active: boolean;
  created_at: string;
}

export interface AdminUser {
  id: string;
  login: string;
  password_hash: string;
  name: string | null;
  last_name: string | null;
  phone: string | null;
  is_super_admin: boolean;
  active: boolean;
  created_at: string;
}

export interface AdminPermission {
  id: string;
  admin_user_id: string;
  can_pause_partners: boolean;
  can_delete_partners: boolean;
  can_create_partners: boolean;
  can_edit_partners: boolean;
  access_all_partners: boolean;
}

export interface AdminUserWithPermissions extends AdminUser {
  permissions: AdminPermission | null;
  accessible_partner_ids: string[];
}

export interface Position {
  id: string;
  name: string;
  can_delete_orders: boolean;
  position_permissions: Array<{ section: string }>;
  position_branches?: Array<{ branch_id: string }>;
}

export interface StaffUser {
  id: string;
  login: string;
  name: string;
  lastName?: string;
  active: boolean;
  partner_id: string;
  roles: Role;
  position?: Position;
  is_staff: boolean;
}

export interface AuthState {
  user: User | StaffUser | null;
  partner: Partner | null;
  role: Role | null;
  adminUser?: AdminUserWithPermissions | null;
}

export interface CourierZonePolygon {
  id: string;
  zone_id: string;
  polygon: Array<{ lat: number; lng: number }>;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PerformerZonePolygon {
  id: string;
  zone_id: string;
  polygon: Array<{ lat: number; lng: number }>;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CourierDeliveryZone {
  id: string;
  partner_id: string;
  name: string;
  color: string;
  price_uah: number;
  courier_payment: number;
  free_delivery_threshold: number | null;
  min_order_amount: number | null;
  created_at: string;
  updated_at: string;
  polygons?: CourierZonePolygon[];
}

export interface PerformerDeliveryZone {
  id: string;
  performer_id: string;
  name: string;
  color: string;
  price_uah: number;
  courier_payment: number | null;
  created_at: string;
  updated_at: string;
  polygons?: PerformerZonePolygon[];
}

export interface Executor {
  id: string;
  partner_id: string;
  name: string;
  own_couriers: boolean;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  payment_for_pour: boolean;
  payment_terminal: boolean;
  payment_cashless: boolean;
  commission_percent: number;
  different_prices: boolean;
  price_markup_percent: number;
  bad_weather_surcharge_percent: number;
  delivery_payer_default: 'restaurant' | 'client';
  default_payment_method_id: string | null;
  status: 'active' | 'inactive';
  delivery_zone_mode: string | null;
  no_zone_message: string | null;
  km_calculation_enabled: boolean;
  price_per_km: number;
  created_at: string;
  updated_at: string;
}

export interface Courier {
  id: string;
  partner_id: string;
  branch_id: string;
  name: string;
  lastname: string;
  phone: string;
  is_active: boolean;
  vehicle_type: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  is_own: boolean;
  created_at: string;
}

export interface PartnerSettings {
  id: string;
  partner_id: string;
  order_completion_norm_minutes: number;
  timezone: string;
  next_order_number: number;
  google_maps_api_key: string | null;
  default_map_address: string | null;
  default_map_lat: number | null;
  default_map_lng: number | null;
  courier_bot_token: string | null;
  courier_bot_enabled: boolean;
  poster_account: string | null;
  poster_api_token: string | null;
  currency_code: string;
  currency_symbol: string;
  courier_no_zone_message: string;
  min_pickup_order_amount: number | null;
  print_agent_name: string | null;
  print_agent_base_url: string | null;
  print_agent_health_path: string | null;
  print_agent_print_path: string | null;
  print_agent_version: string | null;
  print_agent_apk_public_url: string | null;
  print_agent_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchDevice {
  id: string;
  partner_id: string;
  branch_id: string;
  name: string;
  device_key: string;
  printing_enabled: boolean;
  agent_status: 'online' | 'offline' | 'unknown';
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Printer {
  id: string;
  partner_id: string;
  branch_id: string;
  name: string;
  ip: string;
  port: number;
  paper_width: 58 | 80;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchPrintSettings {
  id: string;
  partner_id: string;
  branch_id: string;
  printing_enabled: boolean;
  auto_print_new_order: boolean;
  auto_print_statuses: string[];
  default_printer_id: string | null;
  copies: number;
  allowed_device_id: string | null;
  created_at: string;
  updated_at: string;
}
