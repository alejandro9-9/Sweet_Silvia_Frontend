const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

if (import.meta.env.PROD) {
  if (!configuredApiUrl) {
    throw new Error("VITE_API_URL must be configured for production builds.");
  }

  try {
    const parsedApiUrl = new URL(configuredApiUrl);
    if (parsedApiUrl.protocol !== "http:" && parsedApiUrl.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new Error("VITE_API_URL must be an absolute HTTP(S) URL.");
  }
}

export const clientEnv = {
  apiUrl: configuredApiUrl,
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS === "true",
  izipayEnabled: import.meta.env.VITE_IZIPAY_ENABLED === "true",
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  whatsappPhone: import.meta.env.VITE_WHATSAPP_PHONE,
};
