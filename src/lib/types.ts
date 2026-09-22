export type ApiRole = "Cliente" | "Administrador" | "Asistente";

export type AuthUser = {
  id: string;
  email: string;
  role: ApiRole;
  roleId: string;
};

export type ApiError = {
  code?: string;
  message?: string;
  error?: string;
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
};

export type AuditLog = {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  entityName: string;
  entityId: string | null;
  occurredAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  oldValuesJson: string | null;
  newValuesJson: string | null;
  observation: string | null;
};

export type LoginResponse = {
  token: string;
};

export type CreatedResponse = {
  id: string;
};

export type Category = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
};

export type Collection = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
};

export type Product = {
  id: string;
  categoryId: string;
  collectionId: string | null;
  name: string;
  description: string | null;
  basePrice: number;
  currency: string;
  isActive: boolean;
  displayOrder?: number;
};

export type ProductVariant = {
  id: string;
  productId: string;
  size: string;
  color: string;
  sku: string;
  physicalStock: number;
  price: number | null;
  currency: string | null;
  shippingWeightKg: number;
  shippingLengthCm: number;
  shippingWidthCm: number;
  shippingHeightCm: number;
  isActive: boolean;
};

export type ProductImage = {
  id: string;
  productId: string;
  productVariantId: string | null;
  url: string;
  altText: string | null;
  order: number;
  isMain: boolean;
};

export type ShippingDestinationType = "lima" | "province";

export type Department = {
  id: string;
  name: string;
  destinationType: ShippingDestinationType;
  isActive: boolean;
};

export type Province = {
  id: string;
  departmentId: string;
  name: string;
  isActive: boolean;
};

export type District = {
  id: string;
  provinceId: string;
  name: string;
  ubigeo: string | null;
  isActive: boolean;
};

export type ShippingCost = {
  shippingRateId: string;
  courierId: string;
  cost: number;
  currency: string;
  estimatedTime: string | null;
  chargeableWeightKg: number;
  volumetricWeightKg: number;
  actualWeightKg: number;
  volumeSurcharge: number;
};

export type ShippingRate = {
  id: string;
  courierId: string;
  courierType: Courier["type"];
  departmentId: string;
  provinceId: string | null;
  districtId: string | null;
  destinationType: ShippingDestinationType;
  serviceType: "regular" | "express" | string;
  cost: number;
  currency: string;
  freeShippingMinimumAmount: number | null;
  estimatedTime: string | null;
  isActive: boolean;
};

export type OlvaAgency = {
  id: string;
  code: string;
  name: string;
  type: string | null;
  department: string | null;
  province: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  scheduleJson: string | null;
  latitude: number | null;
  longitude: number | null;
  lastSyncedAt: string;
};

export type OlvaQuoteLocation = {
  ubigeo: string;
  department: string;
  province: string;
  district: string;
  agencyCount: number;
};

export type Courier = {
  id: string;
  name: string;
  type: "agency" | "deliveryApp" | "ownDelivery";
  requiresExternalIntegration: boolean;
  isActive: boolean;
};

export type PaymentMethod = {
  id: string;
  name: string;
  type: "gateway" | "manual" | "cash";
  requiresManualVerification: boolean;
  requiresExternalIntegration: boolean;
  isActive: boolean;
};

export type Order = {
  id: string;
  userId: string;
  addressId: string | null;
  shippingAgencyId: string | null;
  couponId: string | null;
  status:
    | "pendingReceipt"
    | "receiptInReview"
    | "paid"
    | "preparing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "outOfStock";
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string | null;
};

export type Payment = {
  id: string;
  orderId: string;
  paymentMethodId: string;
  status: "pendingReceipt" | "inReview" | "approved" | "rejected" | "voided" | "pendingGateway";
  amount: number;
  currency: string;
  transactionCode: string | null;
  authorizationCode: string | null;
  gatewayTransactionId: string | null;
  gatewayExpiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
  receiptUploadedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  observation: string | null;
};

export type UserStatus = "active" | "inactive" | "blocked";

export type UserAccount = {
  id: string;
  roleId: string;
  name: string;
  paternalSurname: string;
  maternalSurname: string | null;
  phone: string | null;
  email: string;
  status: UserStatus;
  createdAt: string;
};

export type Address = {
  id: string;
  userId: string;
  receiverName: string;
  receiverPhone: string;
  country: string;
  departmentId: string;
  provinceId: string;
  districtId: string;
  line: string;
  references: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productVariantId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  unitDiscount: number;
  subtotal: number;
  currency: string;
};

export type CartItemSummary = {
  id: string;
  productVariantId: string;
  quantity: number;
};

export type CartAppliedCouponSummary = {
  id: string;
  couponId: string;
  cartItemId: string | null;
  appliedQuantity: number | null;
  estimatedDiscountAmount: number;
  currency: string;
};

export type Cart = {
  id: string;
  userId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: CartItemSummary[];
  appliedCoupons: CartAppliedCouponSummary[];
};

export type CartAppliedCoupon = {
  id: string;
  cartId: string;
  couponId: string;
  scope: "order" | "item";
  cartItemId: string | null;
  appliedQuantity: number | null;
  estimatedDiscountAmount: number;
  currency: string;
  appliedAt: string;
};

export type Coupon = {
  id: string;
  code: string;
  name: string;
  scope: "order" | "item";
  discountType: "amount" | "percentage";
  discountValue: number;
  minimumPurchaseAmount: number | null;
  minimumItemsQuantity: number | null;
  maximumDiscountedItemsQuantity: number | null;
  applicationStrategy: "cheapest" | "mostExpensive" | "firstAdded" | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  maximumTotalUses: number | null;
  maximumUsesPerUser: number | null;
};

export type CouponRestriction = {
  id: string;
  couponId: string;
  categoryId: string | null;
  productId: string | null;
  productVariantId: string | null;
  collectionId: string | null;
};

export type CouponUsage = {
  id: string;
  couponId: string;
  userId: string;
  orderId: string;
  usedAt: string;
  discountAmount: number;
  currency: string;
};

export type Role = {
  id: string;
  name: ApiRole | string;
  isActive: boolean;
};

export type RefreshToken = {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
  deviceInfo: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export type IzipayPaymentLinkResponse = {
  paymentId: string;
  transactionId: string;
  paymentLinkId: string;
  paymentUrl: string;
  amount: string;
  currency: string;
  state: string;
};

export type OrderStatusHistory = {
  id: string;
  orderId: string;
  previousStatus: Order["status"] | null;
  newStatus: Order["status"];
  changedByUserId: string | null;
  changedAt: string;
  observation: string | null;
};

export type StockMovement = {
  id: string;
  productVariantId: string;
  orderId: string | null;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  createdAt: string;
  observation: string | null;
};

export type PaymentReceipt = {
  id: string;
  paymentId: string;
  fileUrl: string;
  operationCode: string | null;
  declaredAmount: number | null;
  currency: string | null;
  uploadedAt: string;
  status: "uploaded" | "approved" | "rejected";
  observation: string | null;
};

export type PaymentReview = {
  id: string;
  paymentId: string;
  reviewerUserId: string;
  result: "approved" | "rejected";
  reviewedAt: string;
  observation: string | null;
};

export type ShipmentStatus = "pending" | "coordinated" | "registered" | "inTransit" | "delivered" | "cancelled" | "observed";

export type Shipment = {
  id: string;
  orderId: string;
  courierId: string;
  status: ShipmentStatus;
  trackingCode: string | null;
  externalShipmentCode: string | null;
  shippingCost: number;
  currency: string;
  createdAt: string;
  registeredExternallyAt: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  observation: string | null;
};

export type ShipmentEvent = {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  description: string;
  location: string | null;
  eventDate: string;
};

export type OlvaTrackingResponse = {
  trackingNumber: string | null;
  status: string | null;
  statusDetail: string | null;
  origin: { agency: string | null; department: string | null } | null;
  destination: { agency: string | null; department: string | null } | null;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  events: { date: string | null; status: string | null; detail: string | null; location: string | null }[];
};

export type UploadResult = {
  id: string;
  url: string;
  key: string;
};
