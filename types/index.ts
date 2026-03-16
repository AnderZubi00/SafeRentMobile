export type UserRole = "TENANT" | "LANDLORD" | "ADMIN";
export type PropertyStatus = "AVAILABLE" | "RENTED" | "MAINTENANCE" | "INACTIVE";
export type RentalStatus = "PENDING" | "ACTIVE" | "ENDED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type ContractStatus = "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  price: number;
  deposit: number;
  bedrooms: number;
  bathrooms: number;
  squareMeters: number;
  status: PropertyStatus;
  images: string[];
  amenities: string[];
  landlordId: string;
  landlord?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Rental {
  id: string;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  deposit: number;
  status: RentalStatus;
  tenantId: string;
  tenant?: User;
  propertyId: string;
  property?: Property;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  description?: string;
  dueDate: string;
  paidAt?: string;
  rentalId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  status: ContractStatus;
  pdfUrl?: string;
  signaturitId?: string;
  signedAt?: string;
  content: Record<string, unknown>;
  rentalId: string;
  signedById: string;
  createdAt: string;
  updatedAt: string;
}
