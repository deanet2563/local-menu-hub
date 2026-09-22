// Test-only adapter. Never contacts auth, the database, or the order Worker.
const params = new URLSearchParams(location.search);
export const state = { orders: [] as unknown[], quotes: 0, failed: params.has('fail') };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export const publicSupabase = {
  from(table: string) {
    let id = 'shop-a';
    const chain: any = {
      select: () => chain, eq: (key: string, value: string) => { if (key === 'shop_id') id = value; return chain; },
      not: () => chain, gte: () => chain, lte: () => chain, limit: () => chain,
      update: () => chain,
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
      maybeSingle: async () => {
        await wait(Number(params.get('shopDelay') || 120));
        if (table === 'customers') return { data: { name: 'Test Customer', phone: '0800000000' }, error: null };
        if (state.failed) return { data: null, error: new Error('offline') };
        return { data: {
          shop_id: id, name: 'Test Shop', delivery_enabled: !params.has('pickup'), pickup_enabled: true,
          payment_cash_enabled: true, payment_qr_enabled: false, qr_code_url: null,
          accepts_preorders: false, is_open: true, business_hours: null,
          category: 'Food', lat: 13.77, lng: 100.67, logo_url: null,
        }, error: null };
      },
    };
    return chain;
  },
};
export const supabase = publicSupabase;
export const getCurrentCustomerId = async () => 'test-customer';
export const submitOrder = async (order: unknown) => { state.orders.push(order); return { ok: true }; };
export const DELIVERY_PLACE_SEARCH_MIN_LENGTH = 3;
export const searchDeliveryPlaces = async () => [];
export const googleMapsPreviewUrl = () => 'https://maps.google.com/';
export const resolveDeliveryLocation = async () => ({ lat: 13.78, lng: 100.68, source: 'map_pin', accuracy: null });
export const quoteDeliveryRoute = async () => { state.quotes++; return { distanceMeters: 1000, deliveryFee: 10, quoteToken: 'test-only' }; };
