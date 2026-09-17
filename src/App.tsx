import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import HomePage from "@/app/page";
import AdminOperationsPage from "@/app/admin/operations/page";
import AdminProductsPage from "@/app/admin/products/page";
import AdminSettingsPage from "@/app/admin/settings/page";
import AdminUploadsPage from "@/app/admin/uploads/page";
import CartPage from "@/app/cart/page";
import CatalogPage from "@/app/catalog/page";
import DashboardPage from "@/app/dashboard/page";
import LoginPage from "@/app/login/page";
import PaymentsPage from "@/app/payments/page";
import ProductDetailPage from "@/app/products/[id]/page";
import ProfilePage from "@/app/profile/page";
import { PrivacyPolicyPage, TermsAndConditionsPage } from "@/components/LegalPages";
import { AuthProvider } from "@/lib/auth";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<HomePage />} path="/" />
          <Route element={<CatalogPage />} path="/catalog" />
          <Route element={<ProductDetailPage />} path="/products/:id" />
          <Route element={<CartPage />} path="/cart" />
          <Route element={<CartPage checkoutOnly />} path="/checkout" />
          <Route element={<LoginPage />} path="/login" />
          <Route element={<TermsAndConditionsPage />} path="/terms-and-conditions" />
          <Route element={<PrivacyPolicyPage />} path="/privacy-policy" />
          <Route element={<ProfilePage />} path="/profile" />
          <Route element={<DashboardPage />} path="/dashboard" />
          <Route element={<PaymentsPage />} path="/payments" />
          <Route element={<AdminProductsPage />} path="/admin/products" />
          <Route element={<AdminOperationsPage />} path="/admin/operations" />
          <Route element={<AdminSettingsPage />} path="/admin/settings" />
          <Route element={<AdminUploadsPage />} path="/admin/uploads" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
