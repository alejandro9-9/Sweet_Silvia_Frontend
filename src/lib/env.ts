export const clientEnv = {
  apiUrl: import.meta.env.VITE_API_URL,
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS === "true",
  izipayEnabled: import.meta.env.VITE_IZIPAY_ENABLED === "true",
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  whatsappPhone: import.meta.env.VITE_WHATSAPP_PHONE,
};
