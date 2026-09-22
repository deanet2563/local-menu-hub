/** One checkout map and its Google-owned DOM per page lifetime. React owns only
 * the slot. Release BEFORE React removes that slot (useLayoutEffect cleanup).
 * Keeping just the Map object is insufficient: late SDK callbacks need its DOM.
 */
export function createRetainedMapHost<T>() {
  let cached: { map: T; element: HTMLDivElement; parking: HTMLDivElement } | null = null;
  let owner: symbol | null = null;

  return {
    acquire(slot: HTMLElement, create: (element: HTMLDivElement) => T) {
      if (owner) throw new Error("Checkout map already has an owner");
      if (!slot.isConnected) throw new Error("Checkout map slot is detached");
      const token = Symbol("checkout-map-owner");
      if (!cached) {
        const element = slot.ownerDocument.createElement("div");
        element.style.cssText = "width:100%;height:100%";
        slot.appendChild(element);
        try {
          const map = create(element);
          const parking = slot.ownerDocument.createElement("div");
          parking.style.cssText = "position:fixed;left:-10000px;top:0;width:400px;height:320px;visibility:hidden;pointer-events:none";
          parking.setAttribute("aria-hidden", "true");
          parking.inert = true;
          slot.ownerDocument.body.appendChild(parking);
          cached = { map, element, parking };
        } catch (error) {
          element.remove();
          throw error;
        }
      } else {
        slot.appendChild(cached.element);
      }
      owner = token;
      const session = cached;
      return {
        map: session.map,
        release() {
          if (owner !== token) return;
          const size = slot.getBoundingClientRect();
          session.parking.style.width = `${size.width || 400}px`;
          session.parking.style.height = `${size.height || 320}px`;
          session.parking.appendChild(session.element);
          owner = null;
        },
      };
    },
  };
}
