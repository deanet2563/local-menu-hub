import {
  DELIVERY_PLACE_SEARCH_MIN_LENGTH,
  normalizeDeliveryPlaceSearchResults,
  type DeliveryPlaceSearchResponse,
} from "@/lib/deliveryLocation";

const response: DeliveryPlaceSearchResponse = {
  ok: true,
  results: [
    {
      placeId: "places/one",
      displayName: "The Paseo",
      formattedAddress: "Bangkok",
      lat: 13.72,
      lng: 100.71,
    },
    {
      placeId: "places/bad",
      displayName: "Broken",
      formattedAddress: "No coordinate",
      lat: Number.NaN,
      lng: 100.71,
    },
  ],
};

export const deliveryLocationSearchCompileChecks = {
  minLength: DELIVERY_PLACE_SEARCH_MIN_LENGTH,
  normalized: normalizeDeliveryPlaceSearchResults(response).map((result) => result.placeId),
};
