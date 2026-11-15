export type OrderStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string | null;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customer_email: string;
  customer_name: string | null;
  shipping_address: string | null;
  invoice_path: string | null;
  failure_reason: string | null;
  status: OrderStatus;
  created_at: string;
  items: OrderItem[];
  total: number;
  user_id: string | null;
}

export interface CustomerInfo {
  name: string;
  email: string;
  address: string;
}
