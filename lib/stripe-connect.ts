import { api } from "./api";

export interface EstadoStripeConnect {
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  charges_enabled: boolean;
  /** Aliases compatibles con la variante web */
  connected?: boolean;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
  accountId?: string | null;
}

export interface OnboardingResponse {
  stripe_account_id?: string;
  onboardingUrl: string;
  /** Alias compatible */
  url?: string;
}

/** Mock de cuenta Stripe (solo desarrollo) */
export async function mockStripeConnect(): Promise<{
  data: OnboardingResponse | null;
  error: string | null;
}> {
  try {
    const data = await api.post<OnboardingResponse>(
      "/pagos/stripe-connect/mock"
    );
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Crea cuenta Stripe Connect Express y devuelve URL de onboarding */
export async function iniciarOnboardingStripe(): Promise<{
  data: OnboardingResponse | null;
  error: string | null;
}> {
  try {
    const data = await api.post<OnboardingResponse>(
      "/pagos/stripe-connect/onboard"
    );
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Refresca un link de onboarding expirado */
export async function refrescarOnboardingStripe(): Promise<{
  data: OnboardingResponse | null;
  error: string | null;
}> {
  try {
    const data = await api.post<OnboardingResponse>(
      "/pagos/stripe-connect/onboard-refresh"
    );
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Estado actual de la cuenta Stripe Connect */
export async function obtenerEstadoStripe(): Promise<{
  data: EstadoStripeConnect | null;
  error: string | null;
}> {
  try {
    const data = await api.get<EstadoStripeConnect>(
      "/pagos/stripe-connect/status"
    );
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}
