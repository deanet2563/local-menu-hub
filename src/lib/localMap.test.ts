import {
  duplicateLocationIds,
  isPublicMapLocation,
  localMapQuality,
  normalizeLocalMapLocation,
  type LocalMapLocationRow,
} from "@/lib/localMap";

const sample = (overrides: Partial<LocalMapLocationRow> = {}) => normalizeLocalMapLocation({
  id: "sonbaobao",
  kind: "shop",
  name: "ซันเปาเปา",
  lat: 13.773212302227083,
  lng: 100.67610292467903,
  approved: true,
  banned: false,
  verification_status: "verified",
  map_visible: true,
  ...overrides,
});

export const localMapContractChecks = {
  verifiedShopPinIsPublic: isPublicMapLocation(sample()),
  unverifiedShopPinHidden: !isPublicMapLocation(sample({ verification_status: "unverified" })),
  pendingCorrectionPinHidden: !isPublicMapLocation(sample({ verification_status: "correction_pending" })),
  rejectedCorrectionPinHidden: !isPublicMapLocation(sample({ verification_status: "rejected" })),
  communityUnavailableWithoutItsOwnVerification: !isPublicMapLocation(sample({ kind: "community", verification_status: "verified" })),
  unapprovedShopHidden: !isPublicMapLocation(sample({ approved: false })),
  bannedShopHidden: !isPublicMapLocation(sample({ banned: true })),
  mapHiddenShopHidden: !isPublicMapLocation(sample({ map_visible: false })),
  missingPinReported: localMapQuality(sample({ lat: null })) === "missing",
  invalidPinReported: localMapQuality(sample({ lat: 91 })) === "invalid",
  noInventedVerification: localMapQuality(sample({ verification_status: null })) === "unverified",
  verifiedPinExplicit: localMapQuality(sample({ verification_status: "verified" })) === "verified",
  stalePinFlagged: localMapQuality(sample({ location_updated_at: "2023-01-01T00:00:00.000Z" })) === "stale",
  exactDuplicateDetection: duplicateLocationIds([
    sample({ id: "a" }),
    sample({ id: "b" }),
    sample({ id: "c", lat: 13.78 }),
  ]).size === 2,
};
